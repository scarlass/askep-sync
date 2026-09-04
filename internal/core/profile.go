package core

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/logger"
	"github.com/scarlass/askep-sync/internal/utils"
	"golang.org/x/crypto/ssh"
)

type Profile struct {
	name string
	conf *configs.ProfileConfig

	project *Project
	pool    *pgxpool.Pool
	sshConn *ssh.Client
}

func NewProfile(name string, project *Project, conf *configs.ProfileConfig) (*Profile, error) {
	return &Profile{
		name:    name,
		conf:    conf,
		project: project,
	}, nil
}

func (p *Profile) Name() string {
	return p.name
}

func (p *Profile) Connect(ctx context.Context) error {
	logger.Infof("connecting to database (%s)", p.Name())

	dsnParts := []string{
		fmt.Sprintf("host=%s", p.conf.Host),
		fmt.Sprintf("port=%d", p.conf.Port),
		fmt.Sprintf("user=%s", p.conf.User),
		fmt.Sprintf("password=%s", p.conf.Password),
		fmt.Sprintf("dbname=%s", p.conf.Database),
		fmt.Sprintf("search_path=%s", utils.ShiftZero(p.conf.Schema, "public")),
	}

	dsn := strings.Join(dsnParts, " ")

	conf, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("unable to parse profile connection %s: %w", p.name, err)
	}

	if p.conf.Proxy != nil {
		sshConn, err := p.dialSSH(p.conf.Proxy)
		if err != nil {
			return fmt.Errorf("unable to connect ssh proxy for profile %s: %w", p.name, err)
		}
		p.sshConn = sshConn

		conf.ConnConfig.DialFunc = func(ctx context.Context, network, addr string) (net.Conn, error) {
			return p.dialSSHContext(ctx, sshConn, network, addr)
		}
	}

	pool, err := pgxpool.NewWithConfig(ctx, conf)
	if err != nil {
		return fmt.Errorf("unable to open connection pool for profile %s: %w", p.name, err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return fmt.Errorf("unable to ping profile %s: %w", p.name, err)
	}

	p.pool = pool
	return nil
}

// dialSSH opens the jump-host connection used to tunnel every subsequent
// pgx dial. Host key is not pinned since profiles only carry user/password,
// not a known-hosts entry; treat this as trusted-network-only until a
// fingerprint field is added to ProfileProxyConfig.
func (p *Profile) dialSSH(proxy *configs.ProfileProxyConfig) (*ssh.Client, error) {
	if proxy.Host == "" {
		return nil, fmt.Errorf("(%s) proxy host cannot be empty", p.name)
	}

	if proxy.User == "" {
		return nil, fmt.Errorf("(%s) proxy user cannot be empty", p.name)
	}

	config := &ssh.ClientConfig{
		User:            proxy.User,
		Auth:            []ssh.AuthMethod{ssh.Password(proxy.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", proxy.Host, proxy.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		return nil, fmt.Errorf("unable to dial ssh proxy %s: %w", addr, err)
	}
	return client, nil
}

// dialSSHContext wraps ssh.Client.Dial, which has no context-aware variant,
// so a stuck dial can still be cancelled via ctx.
func (*Profile) dialSSHContext(ctx context.Context, client *ssh.Client, network, addr string) (net.Conn, error) {
	type result struct {
		conn net.Conn
		err  error
	}

	ch := make(chan result, 1)
	go func() {
		conn, err := client.Dial(network, addr)
		ch <- result{conn, err}
	}()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case res := <-ch:
		return res.conn, res.err
	}
}

func (p *Profile) Close() error {
	if p.pool != nil {
		p.pool.Close()
	}
	if p.sshConn != nil {
		if err := p.sshConn.Close(); err != nil {
			return err
		}
	}

	return nil
}

func (p *Profile) Update(ctx context.Context, param AskepUpdateParam) (err error) {
	var tx pgx.Tx

	defer func() {
		if rec := recover(); rec != nil {
			switch v := rec.(type) {
			case error:
				err = v
			case string:
				err = errors.New(v)
			default:
				err = fmt.Errorf("%v", v)
			}
		}

		if tx != nil {
			if err != nil {
				tx.Rollback(ctx)
			} else {
				err = tx.Commit(ctx)
			}
		}
	}()

	pool := p.pool

	tx, err = pool.Begin(ctx)
	if err != nil {
		return err
	}

	fields := []string{
		"form_data = $${{ .html }}$$",
	}
	sqlparam := map[string]any{
		"alid": param.Alid,
		"html": param.Html,
	}

	if param.NamaForm != "" {
		fields = append(fields, "listname = $${{ .listname }}$$")
		sqlparam["listname"] = param.NamaForm
	}
	if param.KodeForm != "" {
		fields = append(fields, "listcode = $${{ .listcode }}$$")
		sqlparam["listcode"] = param.KodeForm
	}
	if param.InisialForm != "" {
		fields = append(fields, "iform = $${{ .iform }}$$")
		sqlparam["iform"] = param.InisialForm
	}
	if param.KodeSatusehat != "" {
		fields = append(fields,
			"is_satusehat = true",
			"kode_askep_satusehat = $${{ .kodesatusehat }}$$",
		)
		sqlparam["kodesatusehat"] = param.KodeSatusehat
	}

	sql := fmt.Sprintf(`UPDATE askep_list
	SET %s
	WHERE alid = {{ .alid }}`, strings.Join(fields, ", "))

	sql, err = utils.ReplaceTemplateString(sql, sqlparam)
	if err != nil {
		return err
	}

	// logger.Infof("sql -> %s", sql)

	_, err = tx.Exec(ctx, sql)
	return
}

type AskepUpdateParam struct {
	Alid int
	Html string

	NamaForm      string
	InisialForm   string
	KodeForm      string
	KodeSatusehat string
}

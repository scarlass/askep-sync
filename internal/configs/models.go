package configs

type ProfileModel struct {
	ID       int    `db:"id"`
	Host     string `db:"conn_host"`
	Port     int    `db:"conn_port"`
	User     string `db:"conn_user"`
	Password string `db:"conn_pass"`

	ProxyHost string `db:"px_host"`
	ProxyPort string `db:"px_port"`
	ProxyUser string `db:"px_user"`
	ProxyPass string `db:"px_pass"`
}

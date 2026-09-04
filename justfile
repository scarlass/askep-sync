fe:
    cd form-builder && pnpm run dev

serve:
    go run -tags dev . serve

build:
    $(cd form-builder && pnpm run build)

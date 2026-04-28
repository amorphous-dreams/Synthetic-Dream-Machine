.PHONY: help install build test typecheck serve reseed clean

help:
	@echo "Targets:"
	@echo "  make install       Install all workspace dependencies"
	@echo "  make build         Build all packages (core → tldraw → node → app → mcp)"
	@echo "  make test          Run all package test suites"
	@echo "  make typecheck     Run tsc --noEmit across all packages"
	@echo "  make serve         Build app then start lararium serve on :4321"
	@echo "  make reseed        Force-evict + reseed the boot room (server must be running)"
	@echo "  make clean         Remove all dist/ and .lararium-data/ artifacts"

install:
	pnpm install

build:
	pnpm -r build

test:
	pnpm -r test

typecheck:
	pnpm -r exec tsc --noEmit

serve: build
	pnpm --filter @lararium/node serve

reseed:
	curl -s "http://localhost:4321/admin/reseed" | python3 -m json.tool

clean:
	find . -path "*/node_modules" -prune -o -name "dist" -type d -print | grep -v node_modules | xargs rm -rf
	rm -rf .lararium-data

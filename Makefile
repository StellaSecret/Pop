.PHONY: wasm web build test dev e2e clean

wasm:
	wasm-pack build --target web --release --out-dir web/src/wasm --out-name pop_engine

web:
	cd web && npm install && npm run build

build: wasm web

test:
	cargo test --lib

dev: wasm
	cd web && npm run dev

e2e: build
	cd web && npx playwright install chromium && npm run test:e2e

clean:
	cargo clean
	rm -rf web/dist web/node_modules web/test-results web/playwright-report

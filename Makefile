node_modules: yarn.lock
	@yarn -s --pure-lockfile
	@touch node_modules

deps: node_modules

lint: node_modules
	yarn -s run eslint --color .

test: node_modules lint
	NODE_OPTIONS="--experimental-vm-modules --no-warnings" yarn -s run jest --color
	yarn -s run tsc test.js --allowJs --checkJs --noEmit --module es2020 --moduleResolution node --allowSyntheticDefaultImports

unittest: node_modules
	NODE_OPTIONS="--experimental-vm-modules --no-warnings" yarn -s run jest --watchAll

publish:
	git push -u --tags origin master
	npm publish

update: node_modules
	@rm yarn.lock
	@yarn -s
	@touch node_modules

patch: node_modules test
	yarn -s run versions -C patch
	@$(MAKE) --no-print-directory publish

minor: node_modules test
	yarn -s run versions -C minor
	@$(MAKE) --no-print-directory publish

major: node_modules test
	yarn -s run versions -C major
	@$(MAKE) --no-print-directory publish

.PHONY: lint test unittest publish deps update patch minor major

#(require 'ansi-color)
#(add-hook 'compilation-filter-hook 'ansi-color-compilation-filter)
test4:
	ts-node ./process4.ts

test:
	ts-node ./process3.ts

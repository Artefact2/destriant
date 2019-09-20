all: public/index.xhtml public/destriant.js public/destriant.css fetch-ext

public/index.html: src/xhtml/main.html $(shell find src/xhtml -name "*.xhtml")
	head -n-2 $< > $@
	cat src/xhtml/*.xhtml >> $@
	echo "</body></html>" >> $@

public/index.xhtml: public/index.html
	echo '<?xml version="1.0" encoding="utf-8"?>' > $@
	tail -n+2 $< >> $@

public/destriant.js: src/js/main.js $(shell find src/js -name "*.js" -not -name "main.js")
	cat $^ > $@

public/destriant.css: src/scss/main.scss $(shell find src/scss -name "*.scss" -not -name "main.scss")
	cat $^ | sassc -s -t compressed $@

fetch-ext: public/ext/bootstrap.min.css public/ext/bootstrap.bundle.min.js public/ext/jquery.min.js public/ext/localforage.min.js

public/ext:
	mkdir $@

public/ext/bootstrap.min.css:
	make public/ext
	wget -O $@ "https://bootswatch.com/4/darkly/bootstrap.min.css"

public/ext/bootstrap.bundle.min.js:
	wget -O $@ "https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.bundle.min.js"

public/ext/jquery.min.js:
	make public/ext
	wget -O $@ "https://code.jquery.com/jquery-3.4.1.min.js"

public/ext/localforage.min.js:
	make public/ext
	wget -O $@ "https://raw.githubusercontent.com/localForage/localForage/1.7.3/dist/localforage.min.js"

host:
	xdg-open 'http://[::1]:24493' &
	php -S '[::1]:24493' -t public

clean:
	rm -f public/destriant.js public/destriant.css

dist-clean: clean
	rm -Rf public/ext

.PHONY: all fetch-ext host clean dist-clean

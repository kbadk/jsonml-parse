var util = require('util');
var Transform = require('stream').Transform;
var Parser = require('htmlparser2').Parser;
var concat = require('concat-stream');
var isEmpty = require('lodash.isempty');
var decode = (new (require('html-entities').AllHtmlEntities)()).decode;

util.inherits(JSONMLParser, Transform);

function JSONMLParser(options) {
    Transform.call(this);
    this._readableState.objectMode = true;
    this.source = new Parser(this._createSourceOptions(options));
}

JSONMLParser.prototype._transform = function(chunk, encoding, done) {
    this.source.write(chunk, encoding);
    done();
};

JSONMLParser.prototype._flush = function(done) {
    this._onParseDone = done;
    this.source.end();
};

JSONMLParser.prototype._createSourceOptions = function(options) {
    var transform = this;
    var parent;
    return {
        onopentag: function(tagName, attributes) {
            var element = [tagName];
            if (!isEmpty(attributes)) {
                element.push(attributes);
            }
            if (parent) {
                parent.push(element);
                element.parent = parent;
            }
            parent = element;
        },
        ontext: function(text) {
            (parent || transform).push(options.preserveEntities ? text : decode(text));
        },
        oncomment: function(text) {
            (parent || transform).push(['#comment', text]);
        },
        onclosetag: function() {
            var p = parent.parent;
            delete parent.parent;
            if (!p) {
                transform.push(parent);
            }
            parent = p;
        },
        onerror: function(err) {
            transform.emit('error', err);
        },
        onend: function() {
            transform._onParseDone();
        }
    };
};

module.exports = function(markup, callback, options) {
    var parser = new JSONMLParser(options || {});
    if (isEmpty(arguments)) {
        return parser;
    } else {
        parser.pipe(concat({ encoding: 'object' }, function(data) {
            if (!data[1]) data = data[0];
            if (data[0] === "\n" && data[1]) data = data[1];
            callback(null, data);
        }));
        parser.on('error', callback);
        parser.end(markup);
    }
};

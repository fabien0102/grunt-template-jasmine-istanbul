/**
 * Nodeunit tests for the basic template functionality.
 *
 * @author Manuel Leuenberger
 */

var TEMP = '.grunt/temp';
var SRC = 'src/test/js/Generator.js';
var SPEC = 'src/test/js/GeneratorTest.js';
var DEFAULT_TEMPLATE = 'node_modules/grunt-contrib-jasmine/tasks/jasmine/'
		+ 'templates/DefaultRunner.tmpl';

var grunt = require('grunt');
var path = require('path');
var istanbul = require('istanbul');
var instrumenter = new istanbul.Instrumenter({
	noCompact: true
});
var reporter = istanbul.Report.create('html', {
	dir: 'bin/coverage'
});
var collector = new istanbul.Collector();

function getContext () {
	return {
		temp: TEMP,
		css: ['style.css'],
		scripts: {
			jasmine: ['jasmine.js'],
			helpers: ['helper.js'],
			specs: [],
			src: [],
			vendor: ['vendor.js'],
			reporters: ['reporter.js'],
			start: ['start.js']
		},
		options: {
			template: {
				process: function () {
					return '';
				}
			}
		}
	};
}

function getTask () {
	return {
		writeTempFile: function () {},
		copyTempFile: function () {},
		phantomjs: {
			on: function () {}
		}
	};
}

exports['template'] = {
	'setUp': function (callback) {
		this.context = getContext();
		this.task = getTask();
		// instrument and load template
		grunt.file.write('src/main/js/template-instrumented.js',
				instrumenter.instrumentSync(
						grunt.file.read('src/main/js/template.js'),
						'src/main/js/template.js'));
		this.template = require('../../main/js/template-instrumented.js');
		callback();
	},
	'tearDown': function (callback) {
		// write report and delete instrumented template
		collector.add(__coverage__);
		reporter.writeReport(collector, true);
		grunt.file.delete('src/main/js/template-instrumented.js');
		callback();
	},
	'shouldTransitTemplateOptions': function (test) {
		this.context.options.templateOptions = {
			transited: true
		};
		this.template.process(grunt, this.task, this.context);
		test.equal(this.context.options.transited, true,
				'should transit template options');
		test.done();
	},
	'report': {
		'setUp': function (callback) {
			this.context.options.coverage = TEMP + '/coverage/coverage.json';
			this.context.options.report = TEMP + '/coverage';
			this.registered = {};
			this.task.phantomjs.on = (function (scope) {
				return function (event, callback) {
					scope.registered.event = event;
					scope.registered.callback = callback;
				};
			})(this);
			this.template.process(grunt, this.task, this.context);
			callback();
		},
		'shouldRegister': function (test) {
			test.equal(this.registered.event, 'jasmine.coverage',
					'should register for jasmine.coverage');
			test.done();
		},
		'shouldWriteCoverage': function (test) {
			this.registered.callback({});
			test.ok(grunt.file.exists(TEMP + '/coverage/coverage.json'),
					'should write coverage.json');
			grunt.file.delete(TEMP);
			test.done();
		},
		'shouldWriteReport': function (test) {
			this.registered.callback({});
			test.ok(grunt.file.exists(TEMP + '/coverage/index.html'),
					'should write report');
			grunt.file.delete(TEMP);
			test.done();
		}
	},
	'instrumentation': {
		'setUp': function (callback) {
			this.context.scripts.src.push(SRC);
			this.template.process(grunt, this.task, this.context);
			callback();
		},
		'tearDown': function (callback) {
			grunt.file.delete(TEMP);
			callback();
		},
		'shouldIncludeReporter': function (test) {
			test.equal(this.context.scripts.reporters.length, 2,
					'should have added 1 reporter');
			test.equal(this.context.scripts.reporters[0],
					path.join(__dirname, '../../main/js/reporter.js'),
					'should be the coverage reporter');
			test.done();
		},
		'shouldInstrumentSource': function (test) {
			test.equal(this.context.scripts.src.length, 1, 'should have 1 src');
			test.equal(this.context.scripts.src[0], TEMP + '/' + SRC,
					'should store instrumented in temp directory');
			var instrumented = this.context.scripts.src[0];
			var found = grunt.file.read(instrumented).split('\n')[0];
			var expected = 'if (typeof __coverage__ === \'undefined\') '
					+ '{ __coverage__ = {}; }';
			test.equal(found, expected, 'should be instrumented');
			test.done();
		}
	},
	'staticTemplate': {
		'setUp': function (callback) {
			this.context.options.template = DEFAULT_TEMPLATE;
			this.processed = this.template.process(grunt, this.task,
					this.context);
			callback();
		},
		'shouldRender': function (test) {
			this.expected = grunt.util._.template(
					grunt.file.read(DEFAULT_TEMPLATE), this.context);
			test.equal(this.processed, this.expected,
					'should render transparently');
			test.done();
		}
	},
	'dynamicTemplate': {
		'setUp': function (callback) {
			this.context.options.template = {
				process: function (grunt, task, context) {
					return [grunt, task, context];
				}
			};
			this.processed = this.template.process(grunt, this.task,
					this.context);
			callback();
		},
		'shouldRender': function (test) {
			test.strictEqual(this.processed[0], grunt,
					'should be called with grunt');
			test.strictEqual(this.processed[1], this.task,
					'should be called with task');
			test.strictEqual(this.processed[2], this.context,
					'should be called with context');
			test.done();
		}
	}
};
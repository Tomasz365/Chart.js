/* global window: false */
'use strict';

var moment = require('moment');
moment = typeof(moment) === 'function' ? moment : window.moment;

module.exports = function(Chart) {

	var helpers = Chart.helpers;
	var time = {
		units: [{
			name: 'millisecond',
			steps: [1, 2, 5, 10, 20, 50, 100, 250, 500]
		}, {
			name: 'second',
			steps: [1, 2, 5, 10, 30]
		}, {
			name: 'minute',
			steps: [1, 2, 5, 10, 30]
		}, {
			name: 'hour',
			steps: [1, 2, 3, 6, 12]
		}, {
			name: 'day',
			steps: [1, 2, 5]
		}, {
			name: 'week',
			maxStep: 4
		}, {
			name: 'month',
			maxStep: 3
		}, {
			name: 'quarter',
			maxStep: 4
		}, {
			name: 'year',
			maxStep: false
		}]
	};

	var defaultConfig = {
		position: 'bottom',
		time: {
			parser: false, // false == a pattern string from http://momentjs.com/docs/#/parsing/string-format/ or a custom callback that converts its argument to a moment
			format: false, // DEPRECATED false == date objects, moment object, callback or a pattern string from http://momentjs.com/docs/#/parsing/string-format/
			unit: false, // false == automatic or override with week, month, year, etc.
			round: false, // none, or override with week, month, year, etc.
			roundExtremes: 'second', // none, or override with week, month, year, etc.
			displayFormat: false, // DEPRECATED
			isoWeekday: false, // override week start day - see http://momentjs.com/docs/#/get-set/iso-weekday/
			onlyUnique: false,
			maxScaleSize: 200,
			minUnit: 'millisecond',
			formatFunction: null,

			// defaults to unit's corresponding unitFormat below or override using pattern string from http://momentjs.com/docs/#/displaying/format/
			displayFormats: {
				millisecond: 'h:mm:ss.SSS a', // 11:20:01.123 AM,
				second: 'h:mm:ss a', // 11:20:01 AM
				minute: 'h:mm:ss a', // 11:20:01 AM
				hour: 'MMM D, hA', // Sept 4, 5PM
				day: 'll', // Sep 4 2015
				week: 'll', // Week 46, or maybe "[W]WW - YYYY" ?
				month: 'MMM YYYY', // Sept 2015
				quarter: '[Q]Q - YYYY', // Q3
				year: 'YYYY' // 2015
			}
		},
		ticks: {
			autoSkip: false
		}
	};

	var TimeScale = Chart.Scale.extend({
		initialize: function() {
			if (!moment) {
				throw new Error('Chart.js - Moment.js could not be found! You must include it before Chart.js to use the time scale. Download at https://momentjs.com');
			}

			Chart.Scale.prototype.initialize.call(this);
		},
		getLabelMoment: function(datasetIndex, index) {
			if (datasetIndex === null || index === null) {
				return null;
			}

			if (typeof this.labelMoments[datasetIndex] !== 'undefined') {
				return this.labelMoments[datasetIndex][index];
			}

			return null;
		},
		getLabelDiff: function(datasetIndex, index) {
			var me = this;
			if (datasetIndex === null || index === null) {
				return null;
			}

			if (me.labelDiffs === undefined) {
				me.buildLabelDiffs();
			}

			if (typeof me.labelDiffs[datasetIndex] !== 'undefined') {
				return me.labelDiffs[datasetIndex][index];
			}

			return null;
		},
		getMomentStartOf: function(tick) {
			var me = this;
			var unit = me.options.time.roundExtremes;
			if (unit === 'week' && me.options.time.isoWeekday !== false) {
				return tick.clone().startOf('isoWeek').isoWeekday(me.options.time.isoWeekday);
			// } else {
			// 	return tick.clone().startOf(unit);
			}
			return tick.clone().startOf(me.tickUnit);
			return tick.clone().startOf(unit);
		},
		determineDataLimits: function() {
			var me = this;
			me.labelMoments = [];

			// Only parse these once. If the dataset does not have data as x,y pairs, we will use
			// these
			var scaleLabelMoments = [];
			if (me.chart.data.labels && me.chart.data.labels.length > 0) {
				helpers.each(me.chart.data.labels, function(label) {
					var labelMoment = me.parseTime(label);

					if (labelMoment.isValid()) {
						if (me.options.time.round) {
							labelMoment.startOf(me.options.time.round);
						}
						scaleLabelMoments.push(labelMoment);
					}
				}, me);

				me.firstTick = moment.min.call(me, scaleLabelMoments);
				me.lastTick = moment.max.call(me, scaleLabelMoments);
			} else {
				me.firstTick = null;
				me.lastTick = null;
			}

			helpers.each(me.chart.data.datasets, function(dataset, datasetIndex) {
				var momentsForDataset = [];
				var datasetVisible = me.chart.isDatasetVisible(datasetIndex);

				if (typeof dataset.data[0] === 'object' && dataset.data[0] !== null) {
					helpers.each(dataset.data, function(value) {
						var labelMoment = me.parseTime(me.getRightValue(value));

						if (labelMoment.isValid()) {
							if (me.options.time.round) {
								labelMoment.startOf(me.options.time.round);
							}
							momentsForDataset.push(labelMoment);

							if (datasetVisible) {
								// May have gone outside the scale ranges, make sure we keep the first and last ticks updated
								me.firstTick = me.firstTick !== null ? moment.min(me.firstTick, labelMoment) : labelMoment;
								me.lastTick = me.lastTick !== null ? moment.max(me.lastTick, labelMoment) : labelMoment;
							}
						}
					}, me);
				} else {
					// We have no labels. Use the ones from the scale
					momentsForDataset = scaleLabelMoments;
				}

				me.labelMoments.push(momentsForDataset);
			}, me);

			// Set these after we've done all the data
			if (me.options.time.min) {
				me.firstTick = me.parseTime(me.options.time.min);
			}

			if (me.options.time.max) {
				me.lastTick = me.parseTime(me.options.time.max);
			}
// console.log("DETERMINED LAST TICK:",me.lastTick);
			// We will modify these, so clone for later
			me.firstTick = (me.firstTick || moment()).clone();
			me.lastTick = (me.lastTick || moment()).clone();
		},
		buildLabelDiffs: function() {
			var me = this;
			me.labelDiffs = [];
			var scaleLabelDiffs = [];
			// Parse common labels once
			if (me.chart.data.labels && me.chart.data.labels.length > 0) {
				helpers.each(me.chart.data.labels, function(label) {
					var labelMoment = me.parseTime(label);

					if (labelMoment.isValid()) {
						if (me.options.time.round) {
							labelMoment.startOf(me.options.time.round);
						}
						scaleLabelDiffs.push(labelMoment.diff(me.firstTick, me.tickUnit, true));
					}
				}, me);
			}

			helpers.each(me.chart.data.datasets, function(dataset) {
				var diffsForDataset = [];

				if (typeof dataset.data[0] === 'object' && dataset.data[0] !== null) {
					helpers.each(dataset.data, function(value) {
						var labelMoment = me.parseTime(me.getRightValue(value));

						if (labelMoment.isValid()) {
							if (me.options.time.round) {
								labelMoment.startOf(me.options.time.round);
							}
							diffsForDataset.push(labelMoment.diff(me.firstTick, me.tickUnit, true));
						}
					}, me);
				} else {
					// We have no labels. Use common ones
					diffsForDataset = scaleLabelDiffs;
				}

				me.labelDiffs.push(diffsForDataset);
			}, me);
		},

		getFontSize: function(){
			return helpers.getValueOrDefault(this.options.ticks.fontSize, Chart.defaults.global.defaultFontSize);
		},

		getFont: function(){
			var tickFontSize = this.getFontSize();
			var tickFontStyle = helpers.getValueOrDefault(this.options.ticks.fontStyle, Chart.defaults.global.defaultFontStyle);
			var tickFontFamily = helpers.getValueOrDefault(this.options.ticks.fontFamily, Chart.defaults.global.defaultFontFamily);
			return helpers.fontString(tickFontSize, tickFontStyle, tickFontFamily);
		},

		buildTicks: function() {
			// console.error("BuildTicks");
			var me = this;

			me.ctx.save();
			me.ctx.font = this.getFont();

			me.ticks = [];
			me.unitScale = 1; // How much we scale the unit by, ie 2 means 2x unit per step
			me.scaleSizeInUnits = 0; // How large the scale is in the base unit (seconds, minutes, etc)
// me.options.time.unit = 'second';
			// Set unit override if applicable
			if (me.options.time.unit) {
				me.tickUnit = me.options.time.unit || 'day';
				me.displayFormat = me.options.time.displayFormats[me.tickUnit];
				me.scaleSizeInUnits = me.lastTick.diff(me.firstTick, me.tickUnit, true);
				me.unitScale = helpers.getValueOrDefault(me.options.time.unitStepSize, 1);
			} else {
				// Determine the smallest needed unit of the time
				var innerWidth = me.isHorizontal() ? me.width - (me.paddingLeft + me.paddingRight) : me.height - (me.paddingTop + me.paddingBottom);

				// Crude approximation of what the label length might be
				var tempFirstLabel = me.tickFormatFunction(me.firstTick, 0, []);
				var tickLabelWidth = me.ctx.measureText(tempFirstLabel).width;
				var cosRotation = Math.cos(helpers.toRadians(me.options.ticks.maxRotation));
				var sinRotation = Math.sin(helpers.toRadians(me.options.ticks.maxRotation));
				tickLabelWidth = (tickLabelWidth * cosRotation) + (this.getFontSize() * sinRotation);
				var labelCapacity = innerWidth / (tickLabelWidth);

				// Start as small as possible
				me.tickUnit = me.options.time.minUnit;
				me.scaleSizeInUnits = me.lastTick.diff(me.firstTick, me.tickUnit, true);
				me.displayFormat = me.options.time.displayFormats[me.tickUnit];

				var unitDefinitionIndex = 1;
				var unitDefinition = time.units[unitDefinitionIndex];

				// While we aren't ideal and we don't have units left
				// console.log("SETS!",unitDefinition.steps, me);

				while (unitDefinitionIndex < time.units.length) {

					// Can we scale this unit. If `false` we can scale infinitely
					me.unitScale = 1;

					if (helpers.isArray(unitDefinition.steps) && Math.ceil(me.scaleSizeInUnits / labelCapacity) < helpers.max(unitDefinition.steps)) {
						// Use one of the predefined steps
						for (var idx = 0; idx < unitDefinition.steps.length; ++idx) {
							if (unitDefinition.steps[idx] >= Math.ceil(me.scaleSizeInUnits / labelCapacity)) {
								me.unitScale = helpers.getValueOrDefault(me.options.time.unitStepSize, unitDefinition.steps[idx]);
								break;
							}
						}

						break;
					} else if ((unitDefinition.maxStep === false) || (Math.ceil(me.scaleSizeInUnits / labelCapacity) < unitDefinition.maxStep)) {
						// We have a max step. Scale this unit
						me.unitScale = helpers.getValueOrDefault(me.options.time.unitStepSize, Math.ceil(me.scaleSizeInUnits / labelCapacity));
						break;
					} else {
						// Move to the next unit up
						++unitDefinitionIndex;
						unitDefinition = time.units[unitDefinitionIndex];

						me.tickUnit = unitDefinition.name;
						var leadingUnitBuffer = 0;//me.firstTick.diff(me.getMomentStartOf(me.firstTick), me.tickUnit, true);
						var trailingUnitBuffer = 0;//me.getMomentStartOf(me.lastTick.clone().add(1, me.tickUnit)).diff(me.lastTick, me.tickUnit, true);
						me.scaleSizeInUnits = me.lastTick.diff(me.firstTick, me.tickUnit, true) + leadingUnitBuffer + trailingUnitBuffer;
						me.displayFormat = me.options.time.displayFormats[unitDefinition.name];
					}
				}
				// console.log("vysledkom je: ",me.tickUnit,me.unitScale);
			}

			if(this.options.ticks.useBaraniGenerator){
				this.generateTicksBarani();
			} else this.generateTicks();
			me.ctx.restore();


		},

		generateTicks: function(){
			var me = this;
			var roundedStart;
			var uniqueTicks = [];

			// Only round the first tick if we have no hard minimum
			if (!me.options.time.min && 1==0) {
				me.firstTick = me.getMomentStartOf(me.firstTick);
				roundedStart = me.firstTick;
			} else {
				roundedStart = me.getMomentStartOf(me.firstTick);
			}

			// Only round the last tick if we have no hard maximum
			if (!me.options.time.max && 1==0) {
				var roundedEnd = me.getMomentStartOf(me.lastTick);
				var delta = roundedEnd.diff(me.lastTick, me.tickUnit, true);
				if (delta < 0) {
					// Do not use end of because we need me to be in the next time unit
					me.lastTick = me.getMomentStartOf(me.lastTick.add(1, me.tickUnit));
				} else if (delta >= 0) {
					me.lastTick = roundedEnd;
				}

				me.scaleSizeInUnits = me.lastTick.diff(me.firstTick, me.tickUnit, true);
			}

			// Tick displayFormat override
			if (me.options.time.displayFormat) {
				me.displayFormat = me.options.time.displayFormat;
			}

			// first tick. will have been rounded correctly if options.time.min is not specified
			me.ticks.push(me.firstTick.clone());

			// console.log("SCALE TICKS BEFORE: ", me.scaleSizeInUnits, me.tickUnit, me.unitScale, me.width);
			// For every unit in between the first and last moment, create a moment and add it to the ticks tick
			var scaleRatio = 1;
			me.widthScalledSize = me.scaleSizeInUnits;
			if(me.scaleSizeInUnits>me.width) {
				var mmax = me.width;
				scaleRatio = Math.round(me.scaleSizeInUnits / mmax * 100)/100;
				me.widthScalledSize = mmax;
			}
			me.widthScalledSize = me.scaleSizeInUnits;
			// console.log("SCALE TICKS AFTER: ", me.widthScalledSize, scaleRatio);
			for (var i = 1; i <= me.widthScalledSize; ++i) {
				// var y = i*scaleRatio;
				var y = i;
				// var newTick = roundedStart.clone().add(y, me.tickUnit).millisecond(0);
				var newTick = roundedStart.clone().add(y, me.tickUnit);
				// console.log("TICK: ", i, me.scaleSizeInUnits, newTick.format(), me.lastTick.format());

				// Are we greater than the max time
				if (me.options.time.max && newTick.diff(me.lastTick, me.tickUnit, true) >= 0) {
					break;
				}

				if (y % me.unitScale === 0) {
					// console.log("GOTCHA!: ", i, me.scaleSizeInUnits);

					if(me.options.time.onlyUnique){
						if(me.tickFormatFunction(me.ticks[me.ticks.length-1])!=me.tickFormatFunction(newTick)) {
							me.ticks.push(newTick);
						}
					} else {
						me.ticks.push(newTick);
					}
				}
			}
			// console.log(me.ticks);

			// Always show the right tick
			var diff = me.ticks[me.ticks.length - 1].diff(me.lastTick, me.tickUnit);
			if (diff !== 0 || me.scaleSizeInUnits === 0) {
				// this is a weird case. If the <max> option is the same as the end option, we can't just diff the times because the tick was created from the roundedStart
				// but the last tick was not rounded.
				if (me.options.time.max) {
					if(me.ticks.length>0) {
						me.scaleSizeInUnits = me.lastTick.diff(me.ticks[0], me.tickUnit, true);
					} else {
						me.scaleSizeInUnits = me.lastTick.diff(me.lastTick, me.tickUnit, true);
					}
				} else {
					me.scaleSizeInUnits = me.lastTick.diff(me.firstTick, me.tickUnit, true);
				}
				if(me.options.time.onlyUnique){
					if(me.tickFormatFunction(me.ticks[me.ticks.length-1])!=me.tickFormatFunction(me.lastTick.clone())) {
						me.ticks.push(me.lastTick.clone());
					}
				} else {
					me.ticks.push(me.lastTick.clone());
				}
			}
// console.log("TICKS ",me.ticks.length,me.ticks)

			// Invalidate label diffs cache
			me.labelDiffs = undefined;
		},


		generateTicksBarani: function(){
			var me = this;
			var roundedStart;
			var uniqueTicks = [];
			var countOfTicks = 4;
			me.options.customTicksDrawer = me.drawTicksBarani.bind(me);

			roundedStart = me.getMomentStartOf(me.firstTick);

			if (me.options.time.displayFormat) {
				me.displayFormat = me.options.time.displayFormat;
			}



			// first tick. will have been rounded correctly if options.time.min is not specified
			// me.ticks.push(me.firstTick.clone());
			var diff = Math.round(me.lastTick.diff(me.firstTick)/1000);

			var now = me.options.time.timeNow || moment();
			var isNowInChart = false;
			var leftAlign = true;
			if(me.firstTick.valueOf() <= now.valueOf() && me.lastTick >= now.valueOf()){
				me.ticks.push(moment());
				isNowInChart = true;
				leftAlign = Math.abs(moment().diff(me.firstTick)) > Math.abs(moment().diff(me.lastTick));
			} else {
				if(me.firstTick.valueOf()>=now.valueOf()) leftAlign = true;
				else if(me.lastTick.valueOf() <= now.valueOf()) leftAlign = false;
			}


			if(diff==0) return;

			var ticksInterval = diff/(countOfTicks);

			if(diff>=4*86400){
				//Daily interval
				//Hourly interval
				ticksInterval = Math.floor(diff/(countOfTicks)/86400)*86400;
			} else if( diff > 4 * 3600){
				ticksInterval = Math.floor(diff/(countOfTicks)/3600)*3600;
			} else {
				//Mins internval
				ticksInterval = Math.floor(diff/(countOfTicks)/60)*60;
			}
// console.log("VYPOCITANY INTERVAL", me);
			var i = 0;
			if(isNowInChart){
				while(true){
					i++;
					var tick1 = moment(now).subtract(ticksInterval*i,'seconds');
					var tick2 = moment(now).add(ticksInterval*i,'seconds');
					// console.log(tick1.valueOf(),tick2.valueOf(),me.firstTick.valueOf(),me.lastTick.valueOf(),tick1.valueOf()>=me.firstTick.valueOf(), tick2.valueOf()<=me.lastTick.valueOf());
					if(tick1.valueOf()>=me.firstTick.valueOf() || tick2.valueOf()<=me.lastTick.valueOf()){
						if(tick1.valueOf()>=me.firstTick.valueOf()) me.ticks.push(tick1);
						if(tick2.valueOf()<=me.lastTick.valueOf()) me.ticks.push(tick2);
					} else {
						break;
					}
				}
			} else {
				while(true){
					i++;
					if(leftAlign) {
						var tick = moment(me.firstTick).add(ticksInterval * i, 'seconds');
					} else {
						var tick = moment(me.lastTick).subtract(ticksInterval * i, 'seconds');
					}
					if(tick.valueOf()>=me.firstTick.valueOf() && tick.valueOf()<=me.lastTick.valueOf()){
						me.ticks.push(tick);
					} else {
						break;
					}
				}
			}

			/*var ticksInterval = diff/(countOfTicks+1);
			for(var i = 1; i <= countOfTicks; i++){
				var tick = moment(me.firstTick).add(ticksInterval*i,'milliseconds');
				console.log(tick);
				me.ticks.push(tick);
			}*/

			if(me.options.time.showDays) {
				//Zvyraznit dni pokial je to menej ako 12 dni
				// console.log((diff > 86400 || me.firstTick.date() != me.lastTick.date()), diff < 12 * 86400);
				if ((diff > 86400 || me.firstTick.date() != me.lastTick.date()) && diff < 12 * 86400) {
					var ft = moment(me.firstTick);
					while (true) {
						ft.endOf('day').add(1, 'second');
						if (ft.valueOf() < me.lastTick.valueOf()) {
							var t = ft.clone();
							t.special = true;
							me.ticks.push(t);
						} else {
							break;
						}
					}
				}
			}

			me.ticks.sort(function(a,b) {
				return a.valueOf() - b.valueOf();
			})

			// me.ticks.push(me.lastTick.clone());
			me.labelDiffs = undefined;




		},

		drawTicksBarani: function(label, index, toDraw){
			var me = this;
			var options = me.options;
			var gridLines = options.gridLines;

			if(typeof this.tickMoments != 'undefined') {
				var obj = this.tickMoments[index];
				if (typeof obj.special != 'undefined') {
					// console.log("TOTO JE SPECIAL!", label, index, toDraw);
					toDraw.label = "";
					toDraw.glWidth = 1;
					toDraw.glColor = "#000000";
					toDraw.glBorderDash = [2,4];
					// toDraw.glBorderDashOffset = 2;
					if(gridLines.drawTicks){
						toDraw.ty2 = toDraw.ty2 - gridLines.tickMarkLength
					}
				} else if(toDraw.label == "0"){
					toDraw.glWidth = 1;
					toDraw.glColor = "#000000";

				} else if(toDraw.textAlign=="left" && (toDraw.x1+15 > me.left)){
					// console.log(toDraw.label, toDraw.x1, me.left);
					toDraw.textAlign = "center";
				}
			}
		},

		// Get tooltip label
		getLabelForIndex: function(index, datasetIndex) {
			var me = this;
			var label = me.chart.data.labels && index < me.chart.data.labels.length ? me.chart.data.labels[index] : '';

			if (typeof me.chart.data.datasets[datasetIndex].data[0] === 'object') {
				label = me.getRightValue(me.chart.data.datasets[datasetIndex].data[index]);
			}

			// Format nicely
			if (me.options.time.tooltipFormat) {
				label = me.parseTime(label).format(me.options.time.tooltipFormat);
			}

			return label;
		},


		tickFormatCache: {},

		// Function to format an individual tick mark
		tickFormatFunction: function(tick, index, ticks) {
			if(this.options.time.formatFunction!=null) return this.options.time.formatFunction(tick,index,ticks);

			if(this.tickFormatCache[tick.valueOf() + "_" + this.displayFormat]!==undefined){
				var formattedTick = this.tickFormatCache[tick.valueOf() + "_" + this.displayFormat];
			} else {
				var formattedTick = tick.format(this.displayFormat);
				this.tickFormatCache[tick.valueOf() + "_" + this.displayFormat] = formattedTick;
			}
			if(formattedTick.indexOf("\n")>0){
				formattedTick = formattedTick.split("\n");
			}
			var tickOpts = this.options.ticks;

			var callback = helpers.getValueOrDefault(tickOpts.callback, tickOpts.userCallback);

			if (callback) {
				return callback(formattedTick, index, ticks);
			}
			return formattedTick;
		},

		convertTicksToLabels: function() {
			var me = this;
			me.tickMoments = me.ticks;
			me.ticks = me.ticks.map(me.tickFormatFunction, me);
		},
		getPixelForValue: function(value, index, datasetIndex) {
			var me = this;
			var offset = null;
			if (index !== undefined && datasetIndex !== undefined) {
				offset = me.getLabelDiff(datasetIndex, index);
			}

			if (offset === null) {
				if (!value || !value.isValid) {
					// not already a moment object
					value = me.parseTime(me.getRightValue(value));
				}
				if (value && value.isValid && value.isValid()) {
					offset = value.diff(me.firstTick, me.tickUnit, true);
				}
			}
			// console.error("getPixelForValue()", offset);

			if (offset !== null) {
				var decimal = offset !== 0 ? offset / me.scaleSizeInUnits : offset;

				if (me.isHorizontal()) {
					var innerWidth = me.width - (me.paddingLeft + me.paddingRight);
					var valueOffset = (innerWidth * decimal) + me.paddingLeft;
					// console.error("getPixelForValue()", value, index, datasetIndex, decimal, offset, me.scaleSizeInUnits, innerWidth, valueOffset, me.left);

					return me.left + Math.round(valueOffset);
				}
				var innerHeight = me.height - (me.paddingTop + me.paddingBottom);
				var heightOffset = (innerHeight * decimal) + me.paddingTop;

				return me.top + Math.round(heightOffset);
			}
		},
		getPixelForTick: function(index) {
			return this.getPixelForValue(this.tickMoments[index], null, null);
		},
		getValueForPixel: function(pixel) {
			var me = this;
			var innerDimension = me.isHorizontal() ? me.width - (me.paddingLeft + me.paddingRight) : me.height - (me.paddingTop + me.paddingBottom);
			var offset = (pixel - (me.isHorizontal() ? me.left + me.paddingLeft : me.top + me.paddingTop)) / innerDimension;
			offset *= me.scaleSizeInUnits;
			return me.firstTick.clone().add(moment.duration(offset, me.tickUnit).asSeconds(), 'seconds');
		},
		parseTime: function(label) {
			var me = this;
			if (typeof me.options.time.parser === 'string') {
				return moment(label, me.options.time.parser);
			}
			if (typeof me.options.time.parser === 'function') {
				return me.options.time.parser(label);
			}
			// Date objects
			if (typeof label.getMonth === 'function' || typeof label === 'number') {
				return moment(label);
			}
			// Moment support
			if (label.isValid && label.isValid()) {
				return label;
			}
			// Custom parsing (return an instance of moment)
			if (typeof me.options.time.format !== 'string' && me.options.time.format.call) {
				console.warn('options.time.format is deprecated and replaced by options.time.parser. See http://nnnick.github.io/Chart.js/docs-v2/#scales-time-scale');
				return me.options.time.format(label);
			}
			// Moment format parsing
			return moment(label, me.options.time.format);
		}
	});
	Chart.scaleService.registerScaleType('time', TimeScale, defaultConfig);

};

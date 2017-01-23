'use strict';

module.exports = function(Chart) {

	var helpers = Chart.helpers,
		globalOpts = Chart.defaults.global,
		defaultColor = globalOpts.defaultColor;

	globalOpts.elements.point = {
		radius: 3,
		pointStyle: 'circle',
		backgroundColor: defaultColor,
		borderWidth: 1,
		borderColor: defaultColor,
		// Hover
		hitRadius: 1,
		hoverRadius: 4,
		hoverBorderWidth: 1,
		pointWidth: 2,
		pointHoverWidth: 3,
	};

	function xRange(mouseX) {
		var vm = this._view;
		return vm ? (Math.pow(mouseX - vm.x, 2) < Math.pow(vm.radius + vm.hitRadius, 2)) : false;
	}

	function yRange(mouseY) {
		var vm = this._view;
		return vm ? (Math.pow(mouseY - vm.y, 2) < Math.pow(vm.radius + vm.hitRadius, 2)) : false;
	}

	Chart.elements.Point = Chart.Element.extend({
		inRange: function(mouseX, mouseY) {
			var vm = this._view;
			return vm ? ((Math.pow(mouseX - vm.x, 2) + Math.pow(mouseY - vm.y, 2)) < Math.pow(vm.hitRadius + vm.radius, 2)) : false;
		},

		inLabelRange: xRange,
		inXRange: xRange,
		inYRange: yRange,

		getCenterPoint: function() {
			var vm = this._view;
			return {
				x: vm.x,
				y: vm.y
			};
		},
		getArea: function() {
			return Math.PI * Math.pow(this._view.radius, 2);
		},
		tooltipPosition: function() {
			var vm = this._view;
			return {
				x: vm.x,
				y: vm.y,
				padding: vm.radius + vm.borderWidth
			};
		},
		draw: function(dataset) {
			var vm = this._view;
			var ctx = this._chart.ctx;
			var yScale = this._yScale;
			var pointStyle = vm.pointStyle;

			var radius = vm.radius;
			var width = (dataset && dataset.widthFunction?dataset.widthFunction(this._index,dataset,this._xScale.width):null) || vm.width  ;
			var x = vm.x;
			var y = vm.y;

			if (vm.skip) {
				return;
			}

			ctx.strokeStyle = (dataset?dataset.borderColor:null) || vm.borderColor || defaultColor;
			ctx.lineWidth = (dataset?dataset.borderWidth:null) || helpers.getValueOrDefault(vm.borderWidth, globalOpts.elements.point.borderWidth);
			ctx.fillStyle = (dataset?dataset.backgroundColor:null) || vm.backgroundColor || defaultColor;

			Chart.canvasHelpers.drawPoint(ctx, pointStyle, width, x, y, yScale);
		}
	});
};

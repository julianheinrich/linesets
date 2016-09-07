/**
 * 
 */

d3.linearDiagram = function(config) {

	// exposed attributes
	var __ = {
			lineWidth: 4,
			textLineGap: 10,
			zones: [],
			proportions: [],
			lines: [],
			distances: [],
			width: 640,
			height: 480,
			strategy: "greedy"
	};

	extend(__, config);

	// variables that are not exposed
	var contours = [],
		extraSpaceForLabel = 0,
		xSpacing = 25,
		ySpacing = 35,
		g;

	var ld = function(selection) {
		selection = ld.selection = d3.select(selection);

		__.width = selection[0][0].clientWidth;
		__.height = selection[0][0].clientHeight;

		ld.svg = selection
		.append("svg")
		.attr("width", __.width)
		.attr("height", __.height);

		return ld;
	};

	var events = d3.dispatch.apply(this, ["resize"].concat(d3.keys(__)));

	// side effects for setters
	var side_effects = d3.dispatch.apply(this,d3.keys(__))
	// flatten and unique zones to get the contours
	.on("zones", function(d) {
		contours = unique(d.value.reduce(function(a,b) {
			return a.concat(b);
		}));
	})
	.on("width", function(d) {
		ld.resize();
	})
	.on("height", function(d) {
		ld.resize();
	});

	function computeDiagram() {

		// reorder here
		if(__.strategy == "greedy") {
			findZoneOrderByGreedyDifference();
		} else if(__.strategy == "random") {
			findZoneOrderRandomly();
		} else if(__.strategy == "exact") {
			findZoneOrderFromAllPermutations(10*1000);
		} // anything else does not reorder the zones, e.g. "none"

		// reorder proportions to match new zones order
		if(__.proportions.length > 0) {
			var newProportions = new Array();
			for(var i=0; i < __.zones.length; i++) {
				var zone = __.zones[i];
				var index = oldZones.indexOf(zone);
				newProportions[i] = __.proportions[index];
			}
			__.proportions = newProportions;
		}

		var abstractLines = generateLines();
		xSpacing = __.width/(__.zones.length+2);
		ySpacing = __.height/(contours.length+1);
		
//		var multiplier = xSpacing;

//		globalDistances = findDistances(multiplier);

//		globalLines = convertLinesToDistance(abstractLines);

		return abstractLines;

	}
	
	function convertLinesToDistance(abstractLines) {
		var lines = new Array();
		for(var i=0; i < abstractLines.length; i++) {
			var abstractLine = abstractLines[i];
			var line = new Array();
			for(var j=0; j < abstractLine.length; j++) {
				var abstractX = abstractLine[j];
				var x = globalDistances[abstractX];
				line.push(x);
			}
			lines.push(line);
		}
		return lines;
	}

	// the lines in the system, defined by pairs of start and stop data, this returns the notional x array of the lines
	function generateLines() {
		var abstractLines = new Array(); // lines contains arrays that alternates between start and end positions of each line

		var lineStatus = new Array();
		for(var i=0; i < contours.length; i++) {
			lineStatus[i] = -1; // -1 for not currently drawing a line, 1 for drawing a line
		}

		for(var i=0; i < contours.length; i++) {
			var line = new Array();
			var contour = contours[i];
			for(var j=0; j< __.zones.length; j++) {
				var zone = __.zones[j];
				if(contains(zone,contour) && lineStatus[i] == -1) { // zone contains the contour, but was not in previous 
					line.push(j+1);
					lineStatus[i] = 1;
				}
				if(contains(zone,contour) && lineStatus[i] == 1) { // zone contains the contour, and was in previous (null op)
				}
				if(!contains(zone,contour) && lineStatus[i] == -1) { // zone does not contain the contour, and was not in previous (null op)
				}
				if(!contains(zone,contour) && lineStatus[i] == 1) { // zone does not contain the contour, and was in previous 
					line.push(j+1);
					lineStatus[i] = -1;
				}

			}
			if(lineStatus[i] == 1) { // end the line
				line.push(__.zones.length+1);
			}
			abstractLines[i] = line;
		}
		return abstractLines;
	}

	/**
	1. find largest zone
	2. repeat, find next zone closest by a score and place it at start or end of array

	Gready algorithm
	Closness is defined by number of different contours - number of shared contours
	 */
	function findZoneOrderByGreedyDifference() {
		var reorderZones = new Array();
		var remainingZones = __.zones.slice(0); // clone

//		find largest zone and remove it from remainingZones
		var largestZone;
		var largestInd;
		var largestSize = 0;
		for(var i=0; i < remainingZones.length; i++) {
			var zone = remainingZones[i];
			if(zone.length > largestSize) {
				largestSize = zone.length;
				largestInd = i;
				largestZone = zone;
			}
		}
		reorderZones.push(largestZone);
		remainingZones.splice(largestInd,1);

		while(remainingZones.length > 0) {
			var closestZone;
			var closestInd;
			var closestScore = 1000000;
			var diffDirection;
			for(var i=0; i < remainingZones.length; i++) {
				var zone = remainingZones[i];
				var endScore = closeness(reorderZones[reorderZones.length-1],zone);
				if(endScore < closestScore) {
					closestScore = endScore;
					closestInd = i;
					closestZone = zone;
					diffDirection = "end";
				}
				var startScore = closeness(reorderZones[0],zone);
				if(startScore < closestScore) {
					closestScore = startScore;
					closestInd = i;
					closestZone = zone;
					diffDirection = "start";
				}
			}

			if(diffDirection == "end") {
				reorderZones.push(closestZone);
			} else {
				reorderZones.unshift(closestZone);
			}
			remainingZones.splice(closestInd,1);
		}

		__.zones = reorderZones;

	}

	/**
	 returns a number indicating how close the candidate zone is to the
	 existing, laid out, zone. Low numbers are better.
	 */
	function closeness(existing,candidate) {
		var shared = contourShared(existing,candidate).length;
		var diff = contourDifference(existing,candidate).length;
		return diff-shared;
	}

	function contains(arr,e) {
		for(var i=0; i < arr.length; i++) {
			var current = arr[i];
			if(e == current) {
				return true
			}
		}
		return false;

	}

//	Array of contours appearing in both of the zones.
	function contourShared(zone1,zone2) {
		var shared = new Array();
		for(var i=0; i < zone1.length; i++) {
			var contour = zone1[i];
			if(contains(zone2,contour)) {
				shared.push(contour);
			}
		}
		return shared;
	}

//	Array of contours appearing in only one of the zones.
	function contourDifference(zone1,zone2) {
		var diff = new Array();
		for(var i=0; i < zone1.length; i++) {
			var contour = zone1[i];
			if(!contains(zone2,contour)) {
				diff.push(contour);
			}
		}
		for(var i=0; i < zone2.length; i++) {
			var contour = zone2[i];
			if(!contains(zone1,contour)) {
				diff.push(contour);
			}
		}
		return diff;
	}

	ld.render = function() {
		var lines = computeDiagram();

		lineData = [];
		for(var i=0; i < lines.length; i++) {
			var line = lines[i];
			var yPos = ySpacing + i * ySpacing;
			for(var j = 0; j < line.length; j = j + 2) {
				var x1 = line[j] + extraSpaceForLabel;
				var x2 = line[j+1] + extraSpaceForLabel;
				lineData.push([{"x":x1, "y":yPos},
				               {"x":x2, "y":yPos}]);
			}
		};

		var x = d3.scale.linear()
			.domain([0,__.zones.length + 2])
			.range([0,__.width]);

		var lineGenerator = d3.svg.line()
			.x(function(d) {return x(d.x);})
			.y(function(d) {return d.y;})
			.interpolate("linear");

		if (g) {
			g.remove();
		}
		
		g = ld.svg.selectAll(".line")
			.data(lineData)
			.enter().append("path")
			.attr("class", "line")
			.attr("d", lineGenerator);

		return this;
	}

	ld.resize = function() {
		// selection size
		ld.selection.select("svg")
		.attr("width", __.width)
		.attr("height", __.height);
		
		events.resize.call(this, {width: __.width, height: __.height});
		return this;
	};

	// expose the state of the chart
	ld.state = __;
//	ld.flags = flags;

	// create getter/setters
	getset(ld, __, events);

	// expose events
	d3.rebind(ld, events, "on");


	// utility functions 

	function unique(a) {
		return a.reduce(function(p, c) {
			if (p.indexOf(c) < 0 && c.length) p.push(c);
			return p;
		}, []);
	};

	// getter/setter with event firing
	function getset(obj,state,events)  {
		d3.keys(state).forEach(function(key) {
			obj[key] = function(x) {
				if (!arguments.length) {
					return state[key];
				}
				var old = state[key];
				state[key] = x;
				side_effects[key].call(ld,{"value": x, "previous": old});
				events[key].call(ld,{"value": x, "previous": old});
				return obj;
			};
		});
	};

	function extend(target, source) {
		for (key in source) {
			target[key] = source[key];
		}
		return target;
	};

	ld.toString = function() {
		return "Linear Diagram";
	}

	return ld;

}
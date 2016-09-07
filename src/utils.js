/**
 * @author <a href="mailto:P.J.Rodgers@kent.ac.uk">Peter Rodgers</a>
 */

var xSpacing = 25;
var ySpacing = 35;

var xPositions; // the positions of each column, starting at 0 and ending at the end of the diagram

var yTextOffset = 5; // gap from left margin to text

var lineWidth = 4;
var textLineGap = 10

var globalContours = new Array();
var globalZones = new Array();
var globalProportions = new Array();
var globalAbstractDescription = new Array();
var globalLines = new Array();
var globalDistances = new Array();
var maxTextLength;
var extraSpaceForLabel = 0;
var textLengths;
var mergedLines = new Array();



var permutationsTried = 0;


function generateLinearSVG(width,height,textLengthsText,guides,order,line,orientation,strategy,inputColor,outputTo) {

	findExtraSpace(textLengthsText);

	// this is needed to reorder the proportions
	if(globalProportions.length > 0) {
		var oldZones = Array();
		for(var i=0; i < globalZones.length; i++) {
			oldZones[i] = globalZones[i];
		}
	}

	// reorder here
	if(strategy == "greedy") {
		findZoneOrderByGreedyDifference();
	} else if(strategy == "random") {
		findZoneOrderRandomly();
	} else if(strategy == "exact") {
		findZoneOrderFromAllPermutations(10*1000);
	} // anything else does not reorder the zones, e.g. "none"


	// reorder proportions to match new globalZones order
	if(globalProportions.length > 0) {
		var newProportions = new Array();
		for(var i=0; i < globalZones.length; i++) {
			var zone = globalZones[i];
			var index = oldZones.indexOf(zone);
			newProportions[i] = globalProportions[index];
		}
		globalProportions = newProportions;
	}

	var abstractLines = generateLines();

	xSpacing = width/(globalZones.length+2);
	ySpacing = height/(globalContours.length+1);

	var multiplier = xSpacing;

	globalDistances = findDistances(multiplier);

	globalLines = convertLinesToDistance(abstractLines);

	if(globalProportions.length > 0) {
		var currentWidth = globalDistances[globalDistances.length-1]-xSpacing; // xSpacing is the width of the labels
		var desiredWidth = width-2*xSpacing;

		var scaling = desiredWidth/currentWidth;
		multiplier = multiplier*scaling;

		globalDistances = findDistances(multiplier);
		globalLines = convertLinesToDistance(abstractLines);

	}

//	var lineSharing = true;
	var lineSharing = false;
	if(lineSharing) {
		// merge separate lines
		mergeLines();

		// TODO stops here at present - need to replace  global variables with new merged version
		// ALSO store data about where merged lines exist, and change colour when drawing svg
	}


	// this is a fix that just reorders the displayed globals according to a new ordering of contours
	// globalProportions, zone and abstract description order is not changed, so is broken.
	if(order == 'stacked' || order == "gapped") {
		var newOrdering = findContourOrder(order,globalLines);

		var replacementLineOrder = new Array();
		var replacementContourOrder = new Array();
		var replacementDistanceOrder = new Array();
		var replacementTextLengths = new Array();
		for(var i=0; i < newOrdering.length; i++) {
			var newOrder = newOrdering[i];
			replacementLineOrder[i] = globalLines[newOrder];
			replacementContourOrder[i] = globalContours[newOrder];
			replacementDistanceOrder[i] = globalDistances[newOrder];
			replacementTextLengths[i] = textLengths[newOrder];
		}
		globalLines = replacementLineOrder;
		globalContours = replacementContourOrder;
		textLengths = replacementTextLengths;
//		globalDistances = replacementDistanceOrder;
	}



	var svgString = generateSVG(width,height,line,guides,orientation,inputColor,outputTo);

	if(orientation == "vertical") {

		svgString = replaceAll(svgString," x="," _temp_");
		svgString = replaceAll(svgString," y="," x=");
		svgString = replaceAll(svgString," _temp_"," y=");

		svgString = replaceAll(svgString," x1="," _temp_");
		svgString = replaceAll(svgString," y1="," x1=");
		svgString = replaceAll(svgString," _temp_"," y1=");

		svgString = replaceAll(svgString," x2="," _temp_");
		svgString = replaceAll(svgString," y2="," x2=");
		svgString = replaceAll(svgString," _temp_"," y2=");

		svgString = replaceAll(svgString," width="," _temp_");
		svgString = replaceAll(svgString," height="," width=");
		svgString = replaceAll(svgString," _temp_"," height=");

	}

	return svgString;
}



function replaceAll(str,find,replace) {
	return str.replace(new RegExp(find, 'g'), replace);
}

function mergeLines() {

	// clone lines
	var linesClone = new Array();
	for(var i = 0; i < globalLines.length; i++) {
		var line = globalLines[i];
		var lineClone = line.slice(0);
		linesClone[i] = lineClone;
	}


	var stillMerging = true;
	while(stillMerging) {
		var merge1 = -1;
		var merge2 = -1;
		var longestLength = -1;
		for(var i = 0; i < linesClone.length; i++) {
			for(var j = i+1; j < linesClone.length; j++) {
				var line1 = linesClone[i];
				var line2 = linesClone[j];
				if(!overlap(line1,line2)) {
					var length1 = findLineLength(line1);
					var length2 = findLineLength(line2);
					var length = length1+length2;

					if(length > longestLength) {
						longestLength = length;
						merge1 = i;
						merge2 = j;
					}
				}
			}
		}
		if(merge1 == -1) {
			stillMerging = false;
		} else {
			// merge the two lines and remove the second linesClone
			var mergePair = new Array();
			// bring the two lines together
			var line1 = linesClone[merge1];
			var line2 = linesClone[merge2];
			var mergedLine = new Array();
			while(line1.length > 0 || line2.length > 0) {
				if(line1.length == 0) {
					var start2 = line2[0];
					var end2 = line2[1];
					mergedLine[mergedLine.length] = start2;
					mergedLine[mergedLine.length] = end2;
					line2.splice(0,2);
				} else if(line2.length == 0) {
					var start1 = line1[0];
					var end1 = line1[1];
					mergedLine[mergedLine.length] = start1;
					mergedLine[mergedLine.length] = end1;
					line1.splice(0,2);
				} else {
					var start1 = line1[0];
					var end1 = line1[1];
					var start2 = line2[0];
					var end2 = line2[1];
					if(start1 < start2) {
						mergedLine[mergedLine.length] = start1;
						mergedLine[mergedLine.length] = end1;
						line1.splice(0,2);
					} else {
						mergedLine[mergedLine.length] = start2;
						mergedLine[mergedLine.length] = end2;
						line2.splice(0,2);
					}
				}

			}
			linesClone[merge1] = mergedLine; // put the extended line back in merge1
			linesClone.splice(merge2,1); // remove the copied line

			mergePair[0] = merge1;
			mergePair[1] = merge2;
			mergedLines[merged.length] = mergePair;
		}

	}
	return linesClone;
}


// takes two lines, and returns true if they overlap or touch.
function overlap(line1, line2) {
	for(var i=0; i < line1.length-1; i=i+2) {
		var start1 = line1[i];
		var end1 = line1[i+1];
		for(var j=0; j < line2.length-1; j=j+2) {
			var start2 = line2[j];
			var end2 = line2[j+1];
			if(start1 <= start2 && end1 >= start2) {
				return true;
			}
			if(start2 <= start1 && end2 >= start1) {
				return true;
			}
			if(start1 >= start2 && end1 <= start2) {
				return true;
			}
			if(start2 >= start1 && end2 <= start1) {
				return true;
			}
			if(start2 == end1) {
				return true;
			}
			if(start1 == end2) {
				return true;
			}
		}
	}
	return false;
}


function findContourOrder(order,lines) {
	var remainingLines = new Array();
	for(var i = 0; i < lines.length; i++) {
		remainingLines[i] = i;
	}

	// starting line
	var startingLine;
	if(order == "stacked") {
		// find largest line
		startingLine = -1;
		var largestLength = -1;
		for(var i = 0; i < lines.length; i++) {
			var lineLength = findLineLength(lines[i]);
			if(lineLength > largestLength) {
				largestLength = lineLength;
				startingLine = i;
			}
		}
	}
	if(order == "gapped") {
		// find line with most breaks
		startingLine = -1;
		var largestBreaks = -1;
		for(var i = 0; i < lines.length; i++) {
			var breakLength = findBreaksInLine(lines[i]);
			if(breakLength > largestBreaks) {
				largestBreaks = breakLength;
				startingLine = i;
			}
		}
	}

	var ret = new Array();
	ret[0] = startingLine;
	remainingLines.splice(startingLine,1);

	// place closest matches on top or bottom
	while(remainingLines.length > 0) {
		var topLine = lines[ret[0]];
		var bottomLine = lines[ret[ret.length-1]];
		var bestFit = -1;
		var bestLine = new Array();
		var bestLineIndex = -1;
		var fitAtBottom = false;
		for(var i = 0; i < remainingLines.length; i++) {
			var line = lines[remainingLines[i]];
			var topFit = findFit(order,line,topLine);
			var bottomFit = findFit(order,line,bottomLine);
			if(bottomFit >= bestFit) { // this test first biases towards bottom fit
				if(bottomFit == bestFit) { // tie break on length
					if(findLineLength(line) > findLineLength(bestLine)) {
						bestFit = bottomFit;
						bestLine = line;
						bestLineIndex = i;
						fitAtBottom = true;
					}
				} else {
					bestFit = bottomFit;
					bestLine = line;
					bestLineIndex = i;
					fitAtBottom = true;
				}
			}
			if(topFit >= bestFit) {
				if(topFit == bestFit) { // tie break on length
					if(findLineLength(line) > findLineLength(bestLine)) {
						bestFit = topFit;
						bestLine = line;
						bestLineIndex = i;
						fitAtBottom = false;
					}
				} else {
					bestFit = topFit;
					bestLine = line;
					bestLineIndex = i;
					fitAtBottom = false;
				}
			}
		}

		if(fitAtBottom) {
			ret[ret.length] = remainingLines[bestLineIndex];
		} else {
			ret.splice(0,0,remainingLines[bestLineIndex]);
		}

		// remove line
		remainingLines.splice(bestLineIndex,1);

	}

	return ret;
}


function findFit(order,line1,line2) {
	var ret;
	if(order == "stacked") {
		ret = findMaxFit(line1,line2);
	}
	if(order == "gapped") {
		ret = findMinAmbiguityFit(line1,line2);
	}
	return ret;
}

function findMaxFit(line1,line2) {
	// overlaps divided by smallest length, giving total overlap as max of 1
	var length1 = findLineLength(line1);
	var length2 = findLineLength(line2);
	var overlap = findOverlapLength(line1,line2);
	var shortest = length1;
	if(length2 < length1) {
		shortest = length2;
	}
	var ret = overlap/shortest;
	return ret;
}

function findMinAmbiguityFit(line1,line2) {
	// find where line segments begin and end

	var count = 0;

	for(var i = 0; i < line1.length; i += 2) {
		var start1 = line1[i];
		var end1 = line1[i+1];
		for(var j = 0; j < line2.length; j += 2) {
			var start2 = line2[j];
			var end2 = line2[j+1];

			if(start1 == start2) {
				count++;
			}
			if(end1 == end2) {
				count++;
			}
			if(start1 == end2) {
				count++;
			}
			if(end1 == start2) {
				count++;
			}
		}
	}

	return count;
}


// takes two lines and sees how much they overlap
function findOverlapLength(line1, line2) {

	var ret = 0;
	for(var i = 0; i < line1.length; i += 2) {
		var start1 = line1[i];
		var end1 = line1[i+1];
		for(var j = 0; j < line2.length; j += 2) {
			var start2 = line2[j];
			var end2 = line2[j+1];
			var overlap = 0;
			if(start1 >= end2 || start2 >= end1) {
				overlap = 0;
			} else {
				var maxStart = start1;
				if(start2 > start1) {
					maxStart = start2;
				}
				var minEnd = end1;
				if(end2 < end1) {
					minEnd = end2;
				}
				overlap = minEnd-maxStart;
			}
			ret += overlap;
		}
	}
	return ret;
}


// finds the length of a line
function findLineLength(line) {
	var ret = 0;
	for(var i = 0; i < line.length; i += 2) {
		var start = line[i];
		var end = line[i+1];
		ret += end-start;
	}
	return ret;
}





// generate svg from distances, lines and contours
function generateSVG(width,height,lineInput,guides,orientation,inputColor,outputTo) {
	var finalWidth = parseInt(width)+extraSpaceForLabel;
	var svgString = '<svg width="'+finalWidth+'" height="'+height+'">\n';

	var allGuideSVG = "";
	if(guides == "background") {
		var rectangleColor = "#EEE5DE";

		for(var i=1; i < globalDistances.length-1; i=i+2) {
			var distance1 = globalDistances[i]+extraSpaceForLabel;
			var distance2 = globalDistances[i+1]+extraSpaceForLabel;
			var rectangleWidth = distance2-distance1;
			var rectangleSVG = '  <rect  x="'+distance1+'" y="0" width="'+rectangleWidth+'" height="'+height+'" fill="'+rectangleColor+'" stroke-width="0" />'+"\n";
			allGuideSVG += rectangleSVG;
		}
	}

	if(guides == "lines") {
//		var lineColor = "#EEE5DE";
		var lineColor = "#696969";
//		var lineColor = "black";

		for(var i=1; i < globalDistances.length; i=i+1) {
			var distance1 = globalDistances[i]+extraSpaceForLabel;
			var lineSVG = '  <line  x1="'+distance1+'" y1="0" x2="'+distance1+'" y2="'+height+'" stroke="'+lineColor+'" stroke-width="1" />'+"\n";
			allGuideSVG += lineSVG;
		}
	}

	var allOverlapSVG = "";
	if(inputColor == "line" || inputColor == "mono") {
		for(var i=0; i < globalLines.length; i++) {

			var line = globalLines[i];
			var yPos = ySpacing + i*ySpacing;
			var color = findColor(i);
			if(inputColor == "mono") {
				color = "black";
			}

			var yTextPos = yPos+yTextOffset;
			var textX = maxTextLength-textLengths[i]; // right justification
			//			var textX = 0; // left justification
			var textSVG = generateTextSVG(textX,yTextPos,textLengths[i],color,orientation,globalContours[i],outputTo);
			allOverlapSVG += textSVG;
			for(var j=0; j < line.length; j=j+2) {
				var x1 = line[j]+extraSpaceForLabel;
				var x2 = line[j+1]+extraSpaceForLabel;
				//				var x1 = line[j];
				//				var x2 = line[j+1];

				if(lineInput=="wide") {
					lineWidth = ySpacing;
				}

				nextSVG= '  <line x1="'+x1+'" y1="'+yPos+'" x2="'+x2+'" y2="'+yPos+'" stroke="'+color+'" stroke-width="'+lineWidth+'" />'+"\n";

				allOverlapSVG += nextSVG;
			}
		}
	}

	if(inputColor == "overlap") {
		// text
		for(var i=0; i < globalLines.length; i++) {
			var line = globalLines[i];
			var yPos = ySpacing + i*ySpacing;
			var color = "black";

			var yTextPos = yPos+yTextOffset;
			var textX = maxTextLength-textLengths[i]; // right justification
			//			var textX = 0; // left justification
			var textSVG = generateTextSVG(textX,yTextPos,textLengths[i],color,orientation,globalContours[i],outputTo);
			allOverlapSVG += textSVG;
		}

		for(var i=1; i < globalDistances.length-1; i=i+1) {
			var zoneIndex = i-1;
			var zone = globalZones[zoneIndex];
			var color = findColor(zoneIndex);
			var x1 = globalDistances[i]+extraSpaceForLabel;
			var x2 = globalDistances[i+1]+extraSpaceForLabel;
			for(var j=0; j < globalContours.length; j++) {
				var contour = globalContours[j];
				if(zone.indexOf(contour) != -1) {
					if(lineInput=="wide") {
						lineWidth = ySpacing;
					}
					var yPos = ySpacing + j*ySpacing;
					var nextSVG= '  <line x1="'+x1+'" y1="'+yPos+'" x2="'+x2+'" y2="'+yPos+'" stroke="'+color+'" stroke-width="'+lineWidth+'" />'+"\n";
					allOverlapSVG += nextSVG;
				}
			}
		}
	}

	if(guides == "lines" && lineInput=="wide") {
		svgString += allOverlapSVG+allGuideSVG; // guidelines over bars
	} else {
		svgString += allGuideSVG+allOverlapSVG; // otherwise guides behind 
	}

	if(orientation == "horizontal") { // just don't clip if vertical, might have to fix this later
		svgString += '  <clipPath id="clip1"> <rect x="0" y="0" width="'+(xSpacing+extraSpaceForLabel-5)+'" height="'+height+'"/> </clipPath>'+"\n";
	}
	svgString += '</svg>'+"\n"

	return svgString;
}


function findBreaksInLine(line) {
	var ret = line.length/2;
	return ret;
}




/**
	 find the distance separating each column, starts at 0, first column is fixed, and is for the labels
 */
function findDistances(multiplier) {
	var ret = new Array();
	ret.push(0.0);
	ret.push(xSpacing);
	var current = xSpacing
	for(var i = 0; i < globalZones.length; i++) {
		if(globalProportions.length > 0) {
			current += globalProportions[i]*multiplier;
		} else {
			current += xSpacing;
		}
		ret.push(current);
	}
	return ret;
}

/**
 * finds the max text length, plus initializes the globalTextLengths array
 */
function findExtraSpace(textLengthsText) {
	textLengths = textLengthsText.split("-");
	maxTextLength = 0;
	for(var i=0; i < textLengths.length; i++) {
		var length = parseInt(textLengths[i]);
		if(maxTextLength < length) {
			maxTextLength = length;
		}
	}
	extraSpaceForLabel = maxTextLength+textLineGap-xSpacing;
	return extraSpaceForLabel
}


/**
	  1. find largest zone
	  2. repeat, find next zone closest by a score and place it at start or end of array

	  Gready algorithm
	  Closness is defined by number of different contours - number of shared contours
 */
function findZoneOrderByGreedyDifference() {
	var reorderZones = new Array();
	var remainingZones = globalZones.slice(0); // clone

	// find largest zone and remove it from remainingZones
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

	globalZones = reorderZones;

}

/**
 *	Random order.
 */
function findZoneOrderRandomly() {

	seed = findSeed();

	var reorderZones = new Array();
	var remainingZones = globalZones.slice(0); // clone

	while(remainingZones.length > 0) {
//		var nextIndex = Math.floor(Math.random() * (remainingZones.length));
//		this function allows the random function to be seeded, meaning the same result from the same data set
		var nextIndex = Math.floor(random1() * (remainingZones.length));
		var nextZone = remainingZones[nextIndex];
		reorderZones.push(nextZone);
		remainingZones.splice(nextIndex,1);
	}

	globalZones = reorderZones;

}


function findSeed() {
	var combinedString = "";
	for(var i=0; i < globalZones.length; i++) {
		var zone = globalZones[i];
		for(var j=0; j < zone.length; j++) {
			var contour = zone[j];
			combinedString += contour;
		}
	}
	var ret = hashCode(combinedString);
	return ret;
}


function hashCode(str){
	var hash = 0;
	if (str.length == 0) return hash;
	for (i = 0; i < str.length; i++) {
		char = str.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
}


var seed = 0;
function random1() {
	var x = Math.sin(seed++) * 10000;
	return x - Math.floor(x);
}


function findZoneOrderFromAllPermutations(timeout) {
	globalZones = testPermutations(globalZones,timeout);
}


function findDuplicateZoneString() {

	var ret = "";
	for(var i=0; i < globalZones.length-1; i++) {
		var zone1 = globalZones[i];
		for(var j=i+1; j < globalZones.length; j++) {
			var zone2 = globalZones[j];
			var diff = contourDifference(zone1,zone2);
			if(diff.length == 0) { // if they are the same
				for(var k=0; k < zone1.length; k++) {
					var contour = zone1[k];
					ret = ret + contour + " ";
				}
				ret += "| ";
			}

		}
	}
	return ret;
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


// Array of contours appearing in both of the zones.
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

// Array of contours appearing in only one of the zones.
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




function countGapsInLines(abstractLines) {
	var gapCount = 0;
	for(var i=0; i < abstractLines.length; i++) {
		var abstractLine = abstractLines[i];
		var lineGaps = abstractLine.length/2-1;
		gapCount += lineGaps;
	}
	return gapCount;

}



function outputLog(page,abstractDescriptionField,width,height,guides,order,line,orientation,strategy,colour) {
	var date = new Date();
	var dateString = date.toUTCString();

	var referrer = document.referrer;
	if(referrer.length > 0) {
		var index = referrer.indexOf("?");
		if(index > 0) {
			referrer = referrer.substring(0,index);
		}
	}

	writelog(dateString+'%0D%0A'+page+'%0D%0Areferrer='+referrer+'%0D%0Awidth='+width+' height='+height+' guides='+guides+' order='+order+' line='+line+' orientation='+orientation+' strategy='+strategy+' colour='+colour+'%0D%0A'+abstractDescriptionField);
}


function writelog(message) {

	try {
		var request;
		if (window.XMLHttpRequest) {// code for IE7+, Firefox, Chrome, Opera, Safari
			xmlhttp=new XMLHttpRequest();
		} else {// code for IE6, IE5
			xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
		}

		xmlhttp.onreadystatechange=function() {
			if (xmlhttp.readyState==4 && xmlhttp.status==200) {
				return;
			}
		}

		xmlhttp.open("GET","writelog.php?nocache="+Math.random()+"&message="+message,false);
		xmlhttp.send(null);

	} catch (err) {

		if (window.XMLHttpRequest){ 
			try{
				request=new ActiveXObject("Microsoft.XMLHTTP");
				request.open("GET", "writelog.php?nocache="+Math.random()+"&message="+message,false);
				request.send();
				if (request.readyState==4 && request.status == 200) {
					return;
				}
			} catch (err) {
				return;
			}
		} else {
			return errmsg;
		}	
	}

}



function setupGlobal(abstractDescriptionField) {
	globalAbstractDescription = decodeAbstractDescription(abstractDescriptionField);
	globalContours = findContours(globalAbstractDescription);
	globalZones = findZones(globalAbstractDescription);

	/*
var arr = new Array();	
arr.push('A B');
arr.push('B C D');
arr.push('C F R');
arr.push('D');
arr.push('E');
arr.push('F');
arr.push('G');
arr.push('H');
arr.push('G B H');
arr.push('A D H');
arr.push('A D R');

console.log('zones: ' + arr.length+' '+arr);
var start = new Date().getTime();
var permutationCount = findPermutations(arr,1000);
var end = new Date().getTime();
var time = end-start;
console.log('permutations:  '+permutationCount+' execution time: ' + (time/1000.0));
	 */
	/*
var start = new Date().getTime();
var permutations2 = findPermutations2(arr);
var end = new Date().getTime();
var time = end-start;
console.log('permutations2: '+permutations2.length+' execution time: ' + (time/1000.0));
	 */


	globalProportions = new Array();
	if(distanceProportional(globalZones)) {
		globalProportions = findProportions(globalZones);
		globalZones = removeProportions(globalZones);
		// remove zero zones and proportions
		var removeList = new Array();
		for(var i=0; i < globalProportions.length; i++) {
			var proportion = globalProportions[i];
			if(proportion == 0.0) {
				removeList.push(i);
			}
		}
		for(var i=removeList.length-1; i >= 0; i--) {
			var index = removeList[i];
			globalProportions.splice(index,1);
			globalZones.splice(index,1);
		}
		globalContours = findContoursFromZones(globalZones);
	}
}


/**
	 tests to see if the abstract description is distance proportional, meaning there is
	 a number at the end of every line.
 */
function distanceProportional(zones) {
	for(var i=0; i < zones.length; i++) {
		var zone = zones[i];
		var lastElement = zone[zone.length-1]
		if(!isNumber(lastElement)) {
			return false;
		}
	}
	return true;
}


function removeProportions(zones) {
	var ret = new Array();
	for(var i=0; i < zones.length; i++) {
		var zone = zones[i];
		var newZone = new Array();
		for(var j=0; j < zone.length-1; j++) { // get all but last element
			var e = zone[j];
			newZone[j] = e;
		}
		ret[i] = newZone;
	}
	return ret;
}


function findProportions(zones) {
	var ret = new Array();
	for(var i=0; i < zones.length; i++) {
		var zone = zones[i];
		ret[i] = parseFloat(zone[zone.length-1]);
	}
	return ret;
}



function findContoursFromZones(zones) {
	var ret = new Array();
	for(var i=0; i < zones.length; i++) {
		var zone = zones[i];
		for(var j=0; j < zone.length; j++) {
			var e = zone[j];
			if(!contains(ret,e)) {
				ret.push(e);
			}
		}
	}
	ret = sortContours(ret);

	return ret;
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



function generateTextSVG(x,y,length,color,orientation,text,outputTo) {
	var transform = "";
	if(orientation == "vertical") {

		var xMove = -2;
		xMove -= length/Math.sqrt(2);

		var yMove = 0;
		yMove += (length - length/Math.sqrt(2));

		transform='transform="translate('+xMove+','+yMove+') rotate(45,'+y+','+x+')"';
	}

	// fix for the problem of styling - the html iframe and inkscape pick this up differently
	fontText = 'font-family="sans-serif" font-weight="bold" font-size="12px"'
		if(outputTo == "download") {
			fontText = 'style="font-family:Sans;font-weight:bold;font-size:12px;"';
		}

	var textSVG = ' <text id="'+text+'" x="'+x+'" y="'+y+'" fill="'+color+'" '+fontText+' clip-path="url(#clip1)" '+transform+'>'+text+'</text>'+"\n";
	console.log(textSVG);
	return textSVG;
}



function findColor(i) {

	// colorbrewer qualitative option for 12 sets, rearranged order
	var colorbrewerArray = ['rgb(31,120,180)','rgb(51,160,44)','rgb(255,127,0)','rgb(106,61,154)',
	                        'rgb(177,89,40)','rgb(227,26,28)','rgb(166,206,227)','rgb(253,191,111)',
	                        'rgb(178,223,138)','rgb(251,154,153)','rgb(202,178,214)','rgb(255,255,153)']	

	if(i < colorbrewerArray.length) {
		return colorbrewerArray[i];
	}

	var nextColor = i-colorbrewerArray.length;
	predefinedNameArray = ["blue", "magenta", "cyan", "orange", "black", "green", "gray", "yellow", "pink", "purple", "red", "brown", "teal", "aqua"]
	if(nextColor < predefinedNameArray.length) {
		return predefinedNameArray[nextColor];
	}

	return get_random_color();
}


// the lines in the system, defined by pairs of start and stop data, this returns the notional x array of the lines
function generateLines() {
	var abstractLines = new Array(); // lines contains arrays that alternates between start and end positions of each line

	var lineStatus = new Array();
	for(var i=0; i < globalContours.length; i++) {
		lineStatus[i] = -1; // -1 for not currently drawing a line, 1 for drawing a line
	}

	for(var i=0; i < globalContours.length; i++) {
		var line = new Array();
		var contour = globalContours[i];
		for(var j=0; j< globalZones.length; j++) {
			var zone = globalZones[j];
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
			line.push(globalZones.length+1);
		}
		abstractLines[i] = line;
	}
	return abstractLines;
}


function findContours(abstractDescription) {

	// prevent repeated processing
	if(globalContours.length > 0) {
		return globalContours;
	}

	globalContours = new Array();
	var index = 0;
	var adSplit = abstractDescription.split("\n");

	for(var i=0; i < adSplit.length; i++) {
		var line = adSplit[i];
		var lineSplit = line.split(" ");
		for(var j=0; j < lineSplit.length; j++) {
			var contour = lineSplit[j].trim();
			var empty = false;
			try {
				if(contour.length == 0) {
					empty = true;
				}
			} catch (err) {
				empty = true;
			}
			if(!empty) {
				if(!contains(globalContours,contour)) {
					globalContours[index] = contour;
					index++;
				}
			}
		}
	}

	// sort contours
	globalContours = sortContours(globalContours)

	return globalContours;
}

function sortContours(contours) {
	// quick fix for the iPhone misorder
	var index = contours.indexOf("iPhone");
	if(index != -1) {
		contours[index] = "Iphone";
	}

	contours.sort();

	// put iPhone back
	index = contours.indexOf("Iphone");
	if(index != -1) {
		contours[index] = "iPhone";
	}

	return contours;

}

function get_random_color() {
	var letters = '0123456789ABCDEF'.split('');
	var color = '#';
	for (var i = 0; i < 6; i++ ) {
		color += letters[Math.round(Math.random() * 15)];
	}
	return color;
}



function findZones(abstractDescription) {

	// prevent repeated processing
	if(globalZones.length > 0) {
		return globalZones;
	}

	globalZones = new Array();
	var diagramIndex = 0;
	var adSplit = abstractDescription.split("\n");

	for(var i=0; i < adSplit.length; i++) {
		var zone = new Array();
		var zoneIndex = 0;
		var line = adSplit[i];
		var lineSplit = line.split(" ");
		for(var j=0; j < lineSplit.length; j++) {
			var contour = lineSplit[j].trim();
			var empty = false;
			try {
				if(contour.length == 0) {
					empty = true;
				}
			} catch (err) {
				empty = true;
			}
			if(!empty) {
				zone[zoneIndex] = contour;
				zoneIndex++;
			}diagramIndex
		}
		if(zone.length > 0) {
			globalZones[diagramIndex] = zone;
			diagramIndex++;
		}
	}
	return globalZones;
}


function decodeAbstractDescription(abstractDescriptionField) {
	var abstractDescription = decodeURIComponent(abstractDescriptionField);
	while(abstractDescription.indexOf("+") != -1) {
		abstractDescription = abstractDescription.replace("+"," ");
	}
	return abstractDescription;
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


function arrayToString(arr) {
	var ret = "";
	for(var i=0; i < arr.length-1; i++) {
		ret += arr[i]+" ";
	}
	ret += arr[arr.length-1];
	return ret;
}



function isNumber(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}


function escapeHTML(string) {
	var pre = document.createElement('pre');
	var text = document.createTextNode(string);
	pre.appendChild(text);
	return pre.innerHTML;
}



function gup(name) {
	var regexS = "[\\?&]"+name+"=([^&#]*)";
	var regex = new RegExp( regexS );
	var tmpURL = window.location.href;
	var results = regex.exec(tmpURL);
	if(results == null) {
		return '';
	} else {
		return results[1];
	}
}




function randomDiagram(numberOfContours, chanceOfZoneAddition) {

	var zones = findAllZones(numberOfContours);
	var adZones = "";
	for(var i=0; i < zones.length; i++) {
		var z = zones[i];
		if(Math.random() < chanceOfZoneAddition) {
			if(adZones != "") {
				adZones += "\n";
			}
			adZones += z;
		}
	}

	return adZones;
}

/**
 * Returns an array of strings containing all the zone combinations for
 * the contours, contours labelled with a single letter starting at "a" (venn diagram).
 * Does not return the outside contour.
 */
function findAllZones(numberOfContours) {
	var zoneList = new Array();

	var numberOfZones = Math.pow(2,numberOfContours)-1;
	for(var zoneNumber = 1; zoneNumber <= numberOfZones; zoneNumber++) {
		var zone = findZone(zoneNumber);
		zoneList.push(zone);
	}

//	ZoneStringComparator zComp = new ZoneStringComparator();
//	Collections.sort(zoneList,zComp);

	return zoneList;
}



/**
 * Takes a zone number, which should be seen as a binary,
 * indicating whether each contour is in the zone.
 * Contours are assumed to be labelled from "a" onwards.
 */
function findZone(zoneNumber) {
	var zoneString = "";
	var current = zoneNumber;
	var i = 0;
	while(current != 0) {
		if(current%2 == 1) {
			var contourChar = String.fromCharCode(97 + i);
			zoneString += contourChar+" ";
		}
		current = Math.floor(current/2);
		i++;
	}
	zoneString = zoneString.trim();
	return zoneString;
}


function testPermutations(array,timeout) {

	permutationsTried = 0;
	var groupCount;
	var mapping = new Array();

	groupCount = array.length
	mapping = new Array();
	for(var i = 0; i < groupCount; i++) {
		mapping[i] = i;
	}

	var start = Date.now();
	var currentTime = -1;
	var lineBreaks = -1;

	var bestLineBreaks = 9999999;
	var bestOrder = new Array();

	var loop = true;

	while(loop) {
		permutationsTried++;
		lineBreaks = countLineBreaks(mapping);
		if(lineBreaks < bestLineBreaks) {
			bestLineBreaks = lineBreaks;
			bestOrder = mappingToOrder(mapping, array);
		}
		loop = nextPerm(mapping);
		currentTime = Date.now();
		if(currentTime-start > timeout) {
			console.log("timed out after "+(currentTime-start)/1000+" seconds. Permutation count: "+permutationsTried);
			loop = false;
		}

	}
	return bestOrder;
}


function mappingToOrder(mapping, array) {
	var ret = new Array();
	for(var i=0; i < mapping.length; i++) {
		ret[i] = array[mapping[i]];
	}
	return ret;
}


function nextPerm(p) {

	var i;
	for (i= p.length-1; i-- > 0 && p[i] > p[i+1];)
		;
	if (i < 0) {
		return false;
	}

	var j;
	for (j= p.length; --j > i && p[j] < p[i];)
		;
	swap(p, i, j);

	for (j= p.length; --j > ++i; swap(p, i, j))
		;
	return true;
}

function swap(p, i, j) {
	var t= p[i];
	p[i]= p[j];
	p[j]= t;
}



// the lines in the system, defined by pairs of start and stop data, this returns the notional x array of the lines
function countLineBreaks(zones) {
	var breaks = new Array(); // lines contains arrays that alternates between start and end positions of each line
	var lineStatus = new Array();
	for(var i=0; i < globalContours.length; i++) {
		lineStatus[i] = -1; // -1 for not currently drawing a line, 1 for drawing a line
		breaks[i] = -1; // -1 because first occurence of a line will increment the breaks
	}

	for(var i=0; i < globalContours.length; i++) {
		var line = new Array();
		var contour = globalContours[i];
		for(var j=0; j < zones.length; j++) {
			var zone = zones[j];
			if(contains(zone,contour) && lineStatus[i] == -1) { // zone contains the contour, but was not in previous 
				breaks[i] = breaks[i]+1;
				lineStatus[i] = 1;
			}
			if(!contains(zone,contour) && lineStatus[i] == 1) { // zone does not contain the contour, and was in previous 
				lineStatus[i] = -1;
			}

		}
	}

	var count = 0;
	for(var i=0; i < breaks.length; i++) {
		count += breaks[i];
	}

	return count;

}


function factorial(num) {
	var ret=1;
	for (var i = 2; i <= num; i++)
		ret = ret * i;
	return ret;
}





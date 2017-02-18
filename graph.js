var canvas = document.getElementById("canvas");
canvas.width = window.innerWidth - 200;
canvas.height = window.innerHeight;
var ctx = canvas.getContext("2d");
canvas.setAttribute( 'width', window.innerWidth * 0.9 );

//Settings variables
var settings_snap = true;
var settings_theme = 1;

var nodes = [];
var links = [];

//Grid variables
var bounds = [-500, 500];
var grid_size = 20;
var viewport = [ (bounds[0] + bounds[1]) / 2 - ((canvas.width / 2) / grid_size), (bounds[0] + bounds[1]) / 2 - ((canvas.height / 2) / grid_size) ];



/* ------------------------- *\
| --  Utility functions  ---  |
\* ------------------------- */
function format_vec( vec, floor ) { floor = floor || true; return "[" + (floor ? Math.floor( vec[0] ) : vec[0]) + ", " + (floor ? Math.floor( vec[1] ) : vec[1]) + "]"; }
function clamp( num, low, high ) { return Math.min( Math.max( num, low ), high ); }
function fillstroke( oc, oa, fc, fa ) {
	ctx.strokeStyle = oc;
	ctx.globalAlpha = oa;
	ctx.stroke();

	ctx.fillStyle = fc;
	ctx.globalAlpha = fa;
	ctx.fill();

	ctx.globalAlpha = 1;
}
function normalize( vec ) {
	var new_vec = [];
	var mag = 0;
	for(i = 0; i < vec.length; i++ ) { mag += Math.pow( vec[i], 2 ); }
	mag = Math.sqrt( mag );
	for(i = 0; i < vec.length; i++ ) { new_vec.push( vec[i] / mag ); }
	return new_vec;
}
function dot( v1, v2 ) {
	if( v1.length != v2.length ) return;
	var ret = 0;
	for(i = 0; i < v1.length; i++ ) { ret += v1[i] * v2[i]; }
	return ret;
}
function dist( p1, p2 ) {
	return Math.sqrt( Math.pow( p2[0] - p1[0], 2 ) + Math.pow( p2[1] - p1[1], 2 ) );
}
function magnitude( v ) { return dist( v, [0, 0] ); }
Array.prototype.remove = function(from, to) {
	var rest = this.slice((to || from) + 1 || this.length);
	this.length = from < 0 ? this.length + from : from;
	return this.push.apply(this, rest);
};
//Thanks to http://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion for the next two functions
function rgb_to_hsl( r, g, b ) {
	r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if( max == min ) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch( max ) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}
function hsl_to_rgb( h, s, l ){
    var r, g, b;

    if( s == 0 ) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if(t < 0) t += 1;
			if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
//Gets a complementary color by converting the color to HSL, altering its hue, and then converting back
function complementary_color( hex ) {
	if( hex.length != 7 ) return; //Hex number has to be of the form #xxxxxx

	//Convert rgb-hex to HSL
	var v = [ hex.slice( 1, 3 ), hex.slice( 3, 5 ), hex.slice( 5, 7 ) ];
	var hsl = rgb_to_hsl( parseInt( v[0], 16 ), parseInt( v[1], 16 ), parseInt( v[2], 16 ) );

	//Modify the hue of the color to find complement
	hsl = [ ( hsl[0] + 0.333 ) % 1, hsl[1], hsl[2] ];

	//Convert modified HSL to rgb
	var rgb = hsl_to_rgb( hsl[0], hsl[1], hsl[2] );
	rgb = [ rgb[0].toString(16), rgb[1].toString(16), rgb[2].toString(16) ];

	//Convert RGB to hex
	var out = "#" + (rgb[0].length == 1 ? "0" : "") + rgb[0] + (rgb[1].length == 1 ? "0" : "") + rgb[1] + (rgb[2].length == 1 ? "0" : "") + rgb[2];

	//Return the rgb-hex of the modified color.  If the color didn't change, default to light red (usually means original color was white/black/gray)
	return ( hex == out ? "#ff3838" : out );
}
function snap( coords ) {
	return [ Math.round( coords[0] ), Math.round( coords[1] ) ];
}
function random_color() {
	var rgb = [ (Math.floor(Math.random() * 255)).toString(16), (Math.floor(Math.random() * 255)).toString(16), (Math.floor(Math.random() * 255)).toString(16) ];
	return "#" + (rgb[0].length == 1 ? "0" : "") + rgb[0] + (rgb[1].length == 1 ? "0" : "") + rgb[1] + (rgb[2].length == 1 ? "0" : "") + rgb[2];
}
//Takes in an absolute position (in GRID coordinates, not real ones), and returns a GRID coordinate relative to the viewport
function rel_pos( pos ) {
	if( !pos ) { return; }
	return [ pos[0] - viewport[0], pos[1] - viewport[1] ];
}
//Takes in an absolute position (in GRID coordinates, not real ones), and returns a SCREEN coordinate relative to the viewport
function rel_screen_pos( pos ) {
	if( !pos ) { return; }
	var rel = rel_pos( pos );
	return [ rel[0] * grid_size, rel[1] * grid_size ];
}
//Takes in a relative position (in GRID coordinates, not real ones), and returns an absolute GRID coordinate
function abs_pos( pos ) {
	if( !pos ) { return; }
	return [ viewport[0] + pos[0], viewport[1] + pos[1] ];
}

function pointInNode( pos ) {
	for(i = 0; i < nodes.length; i++) {
		if( !nodes[i] ) continue;
		if( nodes[i].pointInBounds( pos ) ) {
			return nodes[i];
		}
	}
	return null;
}

//Given a vector defined by a start and end point, return true if 'pos' is on the right-hand side of the vector, and false if 'pos' is on the left
function toRight( vec_start, vec_end, pos ) {
	/*
	 * Most likley an extremely roundabout way to fix the arc direction but oh well (maybe I'll think of a better way in the future)
	 * We compare the direction of the difference vector between the two nodes and the rejection (perpendicular component) of the
	 * vector pointing to your cursor to determine which "side" of the difference vector your cursor is on.  IF it's to the "left"
	 * of the vector going from node one to node two, we have to reverse the order of the arc angles.
	 */
	var to_right = true;
	var perp = vecProj( vec_start, vec_end, pos )[1];
	var diff = [ vec_end[0] - vec_start[0], vec_end[1] - vec_start[1] ];
	var perp_dir = [ Math.sign( perp[0] ), Math.sign( perp[1] ) ];
	var diff_dir = [ Math.sign( diff[0] ), Math.sign( diff[1] ) ];

	//Check if the direction of the perpendicular is to the right or left of the original vector.  Update to_right bool accordingly
	switch( Math.sign( perp_dir[0] * perp_dir[1] ) ) {
		case 1:
			to_right = !( perp_dir[0] == diff_dir[0] && perp_dir[1] == -diff_dir[1]); break;
		case -1:
			to_right = !( perp_dir[0] == -diff_dir[0] && perp_dir[1] == diff_dir[1] ); break;
		case 0:
			to_right = !( perp_dir[0] == diff_dir[1] && perp_dir[1] == diff_dir[0] ); break;
	}

	return to_right;
}

function pointInDirection( start, end, dist ) {
	var unit_diff = normalize( [ end[0] - start[0], end[1] - start[1] ] );
	return [ start[0] + unit_diff[0] * dist, start[1] + unit_diff[1] * dist ];
}

/*
	Takes three vector positions, and returns the projection and rejection (in that order) of the vector pointing from vec1 to vec3 onto the vector pointing from vec1 to vec2
*/
function vecProj( start, end, pos ) {
	var link_vec = [ end[0] - start[0], end[1] - start[1] ]; //Vector from start to end
	var diff_vec = [ pos[0] - start[0], pos[1] - start[1] ]; //Vector from start to the point

	var proj = dot( diff_vec, normalize( link_vec ) ); //Dot product representing the length of the projection of diff_vec on to link_vec
	var proj_vec = [ normalize( link_vec )[0] * proj, normalize( link_vec )[1] * proj ];
	var perp_vec = [ diff_vec[0] - proj_vec[0], diff_vec[1] - proj_vec[1] ];

	return [ proj_vec, perp_vec, proj, magnitude( perp_vec ) ];
}
function pointInLink( pos ) {
	var link = null;
	var min_dist = 9999999;
	if( pos == null ) return false;

	for(j = 0; j < links.length; j++ ) {
		if( !links || !links[j] ) { continue; }

		var start = pointInDirection( rel_screen_pos( links[j].node_one.position ), rel_screen_pos( links[j].node_two.position ), links[j].node_one.size * grid_size * 0.5 );
		var end = pointInDirection( rel_screen_pos( links[j].node_two.position ), rel_screen_pos( links[j].node_one.position ), links[j].node_two.size * grid_size * 0.5 );

		if( !start || !end ) continue;

		if( links[j].arc_point == null ) {
			var v = vecProj( start, end, pos );
			var proj = v[2];
			var perp = v[3];
			//Check to make sure that the point was within the bounds of the link, and that the point is not too far away perpendicularly
			if( proj < 0 || proj > dist( start, end ) || perp > 50 ) { continue; }

			//If everything passes, then the link is recorded until/if a closer link    is found
			if( perp < min_dist ) {
				min_dist = perp;
				link = links[j];
			}
		} else {
			//If the cursor position is not on the same side of the nodes as the arc point, it clearly is not being selected
			if( toRight( start, end, rel_screen_pos( links[j].arc_point ) ) != toRight( start, end, pos ) ) { continue; }

			var p = equiPoint( rel_screen_pos( links[j].node_one.position ), rel_screen_pos( links[j].arc_point ), rel_screen_pos( links[j].node_two.position ) );
			var d = Math.abs( dist( p, rel_screen_pos( links[j].arc_point ) ) - dist( p, pos ) );

			console.log( "dist: " + d );

			if( d > 50 ) { continue; }

			if( d < min_dist ) {
				min_dist = d;
				link = links[j];
			}
		}
	}

	return link;
}
var toType = function(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase()
}
function perpVec( p1, p2, mag ) { //Returns the normalized perpendicular vector
	var diff_norm = normalize( [ p2[0] - p1[0], p2[1] - p1[1] ] );
	return [ -diff_norm[1], diff_norm[0] ];
}
function equiPoint( p1, p2, p3 ) { //Returns the point equidistant from all three given points
	var midp1 = [ ( p1[0] + p2[0] ) / 2, ( p1[1] + p2[1] ) / 2 ];
	var midp2 = [ ( p2[0] + p3[0] ) / 2, ( p2[1] + p3[1] ) / 2 ];
	var perp1 = [ midp1[0] + perpVec( midp1, p2 )[0] * 2, midp1[1] + perpVec( midp1, p2 )[1] * 2 ];
	var perp2 = [ midp2[0] + perpVec( midp2, p2 )[0] * 2, midp2[1] + perpVec( midp2, p2 )[1] * 2 ];

	var x1 = midp1[0]; var y1 = midp1[1]; var x2 = perp1[0]; var y2 = perp1[1];
	var x3 = midp2[0]; var y3 = midp2[1]; var x4 = perp2[0]; var y4 = perp2[1];

	//Thanks wikipedia
	return [ ((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4))/((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)), ((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4))/((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)) ];
}

/*
 * Returns the intersection points of two circles given their positions and radii in the form
 * Return value of the form [ [ first_intersection_x, first_intersection_y ], [ second_intersection_x, second_intersection_y ] ]
 */
function circleCircleIntersect( x1, y1, r1, x2, y2, r2 ) {
	var diff_x = x2 - x1;
	var diff_y = y2 - y1;
	var d = dist( [x1, y1], [x2, y2] );
	var k = ( d*d + r1*r1 - r2*r2 ) / ( 2 * d );

	var ax1 = x1 + (diff_x * k)/d;
	var ax2 = (diff_y / d) * Math.sqrt( r1*r1 - k*k );
	var ay1 = y1 + (diff_y * k)/d;
	var ay2 = (diff_x / d) * Math.sqrt( r1*r1 - k*k );

	return [ [ ax1 + ax2, ay1 - ay2 ], [ ax1 - ax2, ay1 + ay2 ] ];
}
//Thanks http://stackoverflow.com/questions/16025326/html-5-canvas-complete-arrowhead
function drawArrowhead( x, y, radians ) {
    ctx.save();
    ctx.beginPath();
    ctx.translate( x, y );
    ctx.rotate( radians );
    ctx.moveTo( 0, 0 );
    ctx.lineTo( grid_size / 4, grid_size / 2 );
    ctx.lineTo( -grid_size / 4, grid_size / 2 );
    ctx.closePath();
    ctx.restore();
    ctx.fill();
}


/* ------------------------- *\
| -------  Node class  -----  |
\* ------------------------- */
var Node = function( value, position, size, shape, text, outline_width, outline_color, outline_alpha, fill_color, fill_alpha, font, font_size ) {
	this.value = value || [0];
	this.position = position || [0, 0];
	this.position = snap( this.position );
	this.size = size || 1;
	this.shape = shape || 0;

	this.outline_width = outline_width || 2;
	this.outline_color = outline_color || "#ffffff";
	this.outline_alpha = outline_alpha || 1;
	this.fill_color = fill_color || "#000000";
	this.fill_alpha = fill_alpha || 0;
	this.text = text || "";

	this.font = font || "courier";
	this.font_size = font_size || 1;

	this.selected = false;

	this.index = nodes.length;
	nodes.push(this);
};

Node.prototype.pointInBounds = function( point ) {
	var local_pos = rel_screen_pos( this.position );

	if( this.shape == 0 ) {
		//For a circle-shaped node we can simply check that the distance of the point to the center of the node is less than the radius
		return Math.sqrt( Math.pow( (point[0] - local_pos[0]), 2 ) + Math.pow( (point[1] - local_pos[1]), 2 ) ) < this.size * grid_size / 2;
	} else if( this.shape == 1 ) {
		//For a rectangle, we check the x and y individually against the length and width of the node
		return (point[0] > local_pos[0] - (this.size * grid_size / 2) ) &&
			(point[0] < local_pos[0] + (this.size * grid_size / 2)) &&
			(point[1] > local_pos[1] - (this.size * grid_size / 4)) &&
			(point[1] < local_pos[1] + (this.size * grid_size / 4));
	}

	return false;
};
Node.prototype.select = function( s ) {
	this.selected = s;
};
Node.prototype.setPos = function( pos ) {
	var pos = snap( [ viewport[0] + pos[0], viewport[1] + pos[1] ] );
	for(i = 0; i < nodes.length; i++ ) {
		if( !nodes[i] ) continue;
		if( nodes[i].position[0] == pos[0] && nodes[i].position[1] == pos[1] ) {
			pos = this.position;
		}
	}
	this.position = pos;
}

Node.prototype.drawAsCircle = function( radius ) {
	ctx.beginPath();
	ctx.lineWidth = this.outline_width * grid_size;

	var q = rel_screen_pos( this.position );
	ctx.arc( q[0], q[1], radius, 0, 2*Math.PI );

	fillstroke( this.outline_color, this.outline_alpha, this.fill_color, this.fill_alpha );

	var p = rel_screen_pos( this.position );
	ctx.font = (this.font_size * grid_size).toString() + "px " + this.font;
	ctx.textAlign = "center";

	var lines = [];
	var text = this.text
	var width_calc = this.size * grid_size;
	var spacing = 3;
	var m = this.size * grid_size * 0.5 * Math.sqrt(2);

	if( text.length > 0 ) {
		//Divide the total pixel width of the text by the maximum text pixel width
		//for the node to get how many lines the text needs to be divided up into
		var num_lines = Math.ceil( ctx.measureText( text ).width / m );

		//Divide the maximum pixel width by the average pixel width
		//for each character to determine the number of characters per line
		var line_width = Math.floor( m / ( ctx.measureText( text ).width / text.length ) );

		//Iterate through, push the appropriate substrings of the
		//original text as separate entries (which are the different lines of text) in our lines array
		for(i = 0; i < num_lines; i++ ) { lines.push( text.substring( line_width * i, Math.min( line_width * (i+1), text.length ) ) ); }

		//Determine if the number of lines exceeds the node's capacity.
		//If so, store the cutoff location so a ".." can be added later
		var cutoff = this.size * grid_size / m + 100;
		if( lines.length * ( this.font_size * grid_size + spacing ) > m ) cutoff = Math.floor( m / ( this.font_size * grid_size + spacing ) );

		//Offset so the text is centered vertically
		var start = ( Math.min( lines.length, cutoff ) - 1 ) * ( ( this.font_size * grid_size + spacing ) / 2 );

		//Draw the lines of text
		for(i = 0; i < Math.min( cutoff, lines.length ); i++ ) {
			if( i == cutoff - 1 ) lines[i] = lines[i].substring( 0, lines[i].length - 2 ) + "..";

			ctx.fillText( lines[i], p[0], p[1] + (this.font_size / 2) - start + i * ( spacing + this.font_size * grid_size ) );
		}
	}
};
Node.prototype.drawAsRect = function( width, length ) {
	ctx.beginPath();
	ctx.lineWidth = this.outline_width * grid_size;
	ctx.rect( this.position[0] - viewport[0] - (width / 2), this.position[1] - viewport[1] - (length / 2), length, width );

	fillstroke( this.outline_color, this.outline_alpha, this.fill_color, this.fill_alpha );
}
Node.prototype.draw = function() {
	if( this.selected ) {
		ctx.shadowBlur = 20;
		ctx.shadowColor = this.outline_color;
	}
	switch( this.shape ) {
		case 0:
			this.drawAsCircle( this.size * grid_size / 2 );
			break;
		case 1:
			this.drawAsRect( this.size * grid_size, this.size * grid_size / 2 );
			break;
	}
	ctx.shadowBlur = 0;
	ctx.shadowColor = "transparent";
};
Node.prototype.delete = function() {
	for(i = 0; i < links.length; i++ ) {
		if( !links[i] ) continue;
		if( links[i].node_one.index == this.index || links[i].node_two.index == this.index ) {
			links[i].delete();
		}
	}
	nodes[this.index] = null;

}


/* ------------------------- *\
| ------  Link class  ------  |
\* ------------------------- */

var Link = function( node_one, node_two, width, color, direction, arc ) {
	this.node_one = node_one || null;
	this.node_two = node_two || null;
	this.width = width || 3;
	this.color = color || "#fffff";
	this.arc_point = arc || null;
	this.direction = direction || 0;

	this.position_override = null;
	this.selected = false;

	this.index = links.length;
	links.push(this);
};
Link.prototype.setPositionOverride = function(p) {
	this.position_override = p;
};
Link.prototype.draw = function() {
	if( this.node_one == undefined ) { return; }

	if( this.selected ) {
		ctx.shadowBlur = 20;
		ctx.shadowColor = this.color;
	}

	ctx.lineWidth = this.width * grid_size;
	ctx.strokeStyle = this.color;
	ctx.fillStyle = this.color;

	if( this.arc_point == null ) {
		var p1, p2;

		if( this.position_override == null ) {
			p1 = pointInDirection( rel_screen_pos( this.node_one.position ), rel_screen_pos( this.node_two.position ), this.node_one.size * grid_size * 0.5 );
			p2 = pointInDirection( rel_screen_pos( this.node_two.position ), rel_screen_pos( this.node_one.position ), this.node_two.size * grid_size * 0.5 );
		} else {
			if( this.node_one.pointInBounds( this.position_override ) ) { return; }

			var n = pointInNode( this.position_override );
			if( n == null ) {
				p1 = pointInDirection( rel_screen_pos( this.node_one.position ), this.position_override, this.node_one.size * grid_size * 0.5 );
				p2 = this.position_override;
			} else {
				p1 = pointInDirection( rel_screen_pos( this.node_one.position ), rel_screen_pos( n.position ), this.node_one.size * grid_size * 0.5 );
				p2 = pointInDirection( rel_screen_pos( n.position ), rel_screen_pos( this.node_one.position ), n.size * grid_size * 0.5 );
			}
		}


		ctx.beginPath();
		ctx.moveTo( p1[0], p1[1] );
		ctx.lineTo( p2[0], p2[1] );
		ctx.stroke();

		//Arrowheads
		if( this.direction == -1 || this.direction == 2 ) { drawArrowhead( p1[0], p1[1], Math.atan( ( p2[1] - p1[1] ) / ( p2[0] - p1[0] ) ) + ( ( p2[0] >= p1[0] ) ? -90 : 90) * Math.PI / 180 ); }
		if( this.direction == 1 || this.direction == 2 ) { drawArrowhead( p2[0], p2[1], Math.atan( ( p2[1] - p1[1] ) / ( p2[0] - p1[0] ) ) + ( ( p2[0] >= p1[0] ) ? 90 : -90 ) * Math.PI / 180 ); }
	} else {
		var n1 = rel_screen_pos( this.node_one.position );
		var n2 = rel_screen_pos( this.node_two.position );
		var n3 = rel_screen_pos( this.arc_point );

		var p = equiPoint( n1, n3, n2 );
		var r = dist( p, n3 );
		var to_right = toRight( n1, n2, n3 );

		/*
		 * Calculate the point where the circle of the arc and the node intersect
		 * Use this to calculate the start and end angle of the arc
		 */
		var cc1 = circleCircleIntersect( n1[0], n1[1], this.node_one.size * grid_size * 0.5, p[0], p[1], r )[ to_right ? 0 : 1 ];
		var cc2 = circleCircleIntersect( n2[0], n2[1], this.node_two.size * grid_size * 0.5, p[0], p[1], r )[ to_right ? 1 : 0 ];
		var ang_one = Math.asin( Math.abs( cc1[1] - p[1] ) / dist( cc1, p ) );
		ang_one = p[0] < cc1[0] ? (p[1] < cc1[1] ? ang_one : -ang_one) : (p[1] < cc1[1] ? (Math.PI - ang_one) : Math.PI + ang_one);
		var ang_two = Math.asin( Math.abs( cc2[1] - p[1] ) / dist( cc2, p ) );
		ang_two = p[0] < cc2[0] ? (p[1] < cc2[1] ? ang_two : -ang_two) : (p[1] < cc2[1] ? (Math.PI - ang_two) : (Math.PI + ang_two));

		//Draw the arc and take into account which side the cursor lies on
		ctx.beginPath();
		ctx.arc( p[0], p[1], r, to_right ? ang_one : ang_two, to_right ? ang_two : ang_one );
		ctx.stroke();

		/*if( this.selected ) {
			ctx.beginPath();
			ctx.arc( n3[0], n3[1], 3, 0, Math.PI * 2 );
			ctx.stroke();
		}*/

		//Arrowheads
		var start_diff = [ cc1[0] - n1[0], cc1[1] - n1[1] ];
		var end_diff = [ cc2[0] - n2[0], cc2[1] - n2[1] ];
		if( this.direction == -1 || this.direction == 2 ) { drawArrowhead( cc1[0], cc1[1], Math.atan2( start_diff[1], start_diff[0] ) - Math.PI / 2 ); }
		if( this.direction == 1 || this.direction == 2 ) { drawArrowhead( cc2[0], cc2[1], Math.atan2( end_diff[1], end_diff[0] ) - Math.PI / 2 ); }
	}

	ctx.shadowBlur = 0;
	ctx.shadowColor = "transparent";
};
Link.prototype.delete = function() {
	links[this.index] = null;
};


/* ------------------------- *\
| -----  Main function  ----  |
\* ------------------------- */
(function() {
	var min_grid = [ bounds[0], bounds[0] ];
	var max_grid = [ -min_grid[0] - canvas.width / grid_size, -min_grid[1] - canvas.height / grid_size ];
	var requestID;

	var default_size = 3;
	var default_width = 0.1;
	var default_direction = 1;
	var default_color = "#000000";

	var space_down = false;
	var lc_down = false;
	var rc_down = false;
	var doubleclick = false;
	var mouse_start = [0, 0];
	var mouse_position = [0, 0];
	var mouse_delta = [0, 0];
	var slide_delta = [0, 0];

	var selected = [];
	var relative_pos = [];

	var new_link = null;

	var shift = false;
	var ctrl = false;

	var style;




	window.addEventListener('resize', function() {
		canvas.width = window.innerWidth - 200;
  	  	canvas.height = window.innerHeight;
		draw_all();
	}, false);

	function draw_lines(i) {
		//Vertical lines
		ctx.beginPath();
		ctx.moveTo( (bounds[0] + i - viewport[0]) * grid_size, bounds[0] * grid_size );
		ctx.lineTo( (bounds[0] + i - viewport[0]) * grid_size, bounds[1] * grid_size );
		ctx.stroke();
		//Horizontal lines
		ctx.beginPath();
		ctx.moveTo( bounds[0] * grid_size, (bounds[0] + i - viewport[1]) * grid_size );
		ctx.lineTo( bounds[1] * grid_size, (bounds[0] + i - viewport[1]) * grid_size );
		ctx.stroke();
	}

	function draw_all() {
		//background, large lines, medium lines, small lines
		switch(settings_theme) {
			case 1:
				style = [ "#ffffff", "#000000", true, "#a5f6ff", "#c9d3e2", "#eaeff7" ]; break;
			case 2:
				style = [ "#222222", "#FFFFFF", true, "#40f0f9", "#757575", "#353535" ]; break;
			case 3:
				style = [ "#ffffff", "#000000", false, "", "", "" ]; break;
			case 4:
				style = [ "#222222", "#ffffff", false, "", "", "" ]; break;
		}

		ctx.fillStyle = style[0];
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.lineWidth = 1;

		if( style[2] ) {
			var lines_start = Math.floor( Math.min( viewport[0] - bounds[0], viewport[1] - bounds[0] ) );
			var lines_end = Math.floor( Math.max( viewport[0] + (canvas.width / grid_size) - bounds[0], viewport[1] + (canvas.height / grid_size) - bounds[0] ) );

			//Draw all of the small lines first
			ctx.strokeStyle = style[5];
			for(i = lines_start; i < lines_end; i++ ) { if( i % 25 != 0 && i % 5 != 0 && i != 0 ) { draw_lines(i); } }
			//Draw the medium lines next
			ctx.strokeStyle = style[4];
			for(i = lines_start; i < lines_end; i++) { if( i % 25 != 0 && i % 5 == 0 && i != 0 ) { draw_lines(i); } }
			//Finally, draw the large lines
			ctx.strokeStyle = style[3];
			for(i = lines_start; i < lines_end; i++) { if( i % 25 == 0 && i != 0 ) { draw_lines(i); } }

			ctx.lineWidth = 3;
			draw_lines(-(bounds[0] + (bounds[0]+bounds[1])/2));
			ctx.lineWidth = 1;
		}

		for(j = 0; j < links.length; j++) { if( links[j] ) links[j].draw(); }
		for(j = 0; j < nodes.length; j++) {	if( nodes[j] ) nodes[j].draw(); }
	}



	//Residual slide after drag is finished
	function nav_slide(dir1, dir2) {
		if( slide_delta[0] > 0 != dir1 && slide_delta[1] > 0 != dir2 ) {
			end_slide();
			return;
		}

		//The viewport continues moving in the direction of the slide delta until it reaches 0
		//A ternary statement is used to account for negative directions
		viewport[0] += (dir1 ? Math.max( slide_delta[0], 0 ) : Math.min( slide_delta[0], 0 ) ) / grid_size;
		viewport[1] += (dir2 ? Math.max( slide_delta[1], 0 ) : Math.min( slide_delta[1], 0 ) ) / grid_size;

		//The viewport is then clamped to make sure that the user does not drag it past the bounds of the grid
		viewport = [ clamp( viewport[0], min_grid[0], max_grid[0] ), clamp( viewport[1], min_grid[1], max_grid[1] ) ];

		//Decelerate the absolute value of the slide by taking into account sign
		var decel = 0.3;
		slide_delta = [slide_delta[0] + (decel * (dir1 ? -1 : 1 )), slide_delta[1] + (decel * (dir2 ? -1 : 1))];

		draw_all();
		requestID = window.requestAnimationFrame( function() { nav_slide( dir1, dir2 ); }, canvas );
	}
	function start_slide( dir1, dir2 ) { if( !requestID ) nav_slide( dir1, dir2 ); }
	function end_slide() { if( requestID ) { window.cancelAnimationFrame( requestID ); requestID = undefined; } }

	//Drag-to-navigate functionality
	function nav_drag(e) {
		//offsetX and offsetY give the x and y coords of the mouse pointer from the top left corner of the screen (x is horizontal, y is vertical)
		//Here we compute the difference between where the mouse was at the beginning of the click, and where it is now during the drag
		mouse_delta[0] = -(e.offsetX - mouse_start[0]);
		mouse_delta[1] = -(e.offsetY - mouse_start[1]);

		//This difference is added to the viewport so that the offset of the grid lines is updated
		viewport[0] += (mouse_delta[0] / grid_size);
		viewport[1] += (mouse_delta[1] / grid_size);

		//The viewport is then clamped to make sure that the user does not drag it past the bounds of the grid
		viewport = [ clamp( viewport[0], min_grid[0], max_grid[0] ), clamp( viewport[1], min_grid[1], max_grid[1] ) ];

		//This helps avoid glitchiness/random jumps the next time the user tries to drag
		mouse_start = mouse_position;

		draw_all();

		if( selected.length == 1 ) {
			updateInfo( selected[0], false );
		}
	}




	//Space detection
	document.body.onkeydown = function(e) {
		if( e.keyCode != 32 ) return;

		this.style.cursor = "move"; //Change the cursor to a multi-directional one to signify panning

		end_slide(); //Halt slide event

		space_down = true;
		mouse_start = mouse_position;
	};
	document.body.onkeyup = function(e) {
		if( e.keyCode != 32 ) return; //Only allow left clicks

		this.style.cursor = "auto";

		space_down = false;
		slide_delta = mouse_delta;
		start_slide( mouse_delta[0] > 0, mouse_delta[1] > 0 );//Start slide event when mouse click is released
	};


	function deselect_all() {
		for(i = 0; i < selected.length; i++ )
			selected[i].selected = false;
		selected = [];
	}

	//When the mouse button is pressed down
	canvas.onmousedown = function(e) {
		if( e.which == 1 ) {
			if( !doubleclick ) {
				if( rc_down ) return;
				lc_down = true;

				doubleclick = true;
				var doubleclick_interval = setInterval( function() { doubleclick = false; clearInterval( doubleclick_interval ); }, 200 );

				//Node selection
				var p = pointInNode( mouse_position );
				var l = pointInLink( mouse_position );

				//Different behaviors are needed for if the clicked-on node was selected already
				var found_p = false;
				var found_l = false;
				for(i = 0; i < selected.length; i++ ) {
					if( p && selected[i] instanceof Node && selected[i].index == p.index ) { found_p = true; break; }
					if( l && selected[i] instanceof Link && selected[i].index == l.index ) { found_l = true; break; }
				}
				//Select the new node
				//Only select if the clicked-on node was previously unselected
				if( p && !found_p ) {
					//If ctrl is not down (not selecting multiple nodes), deselect all nodes and links before selecting the new node
					if( !ctrl ) deselect_all();

					selected.push( p );
					p.selected = true;
					default_size = p.size;
					default_width = p.outline_width;
				} else if( l ) {
					//Cannot move a group of nodes/links by a link, so if a link has been clicked
					if( !ctrl ) deselect_all();

					if( !found_l ) {
						selected.push( l );
						l.selected = true;
						default_width = l.width;
					}
				}

				//Update sliders with correct information
				//If multiple items are selected with different attributes, (multiple) is displayed
				if( selected.length >= 1 ) {
					updateInfo( selected[0], selected.length > 1 );

					if( selected.length == 1 ) updateSliders();
					else {
						var v_size = default_size;
						var v_width = default_width;
						for(i = 0; i < selected.length; i++ ) {
							if( v_width != -1 && ( (selected[i] instanceof Node && selected[i].outline_width != default_width ) || ( selected[i] instanceof Link && selected[i].width != default_width ) ) ) v_width = -1;
							if( v_size != -1 && ( selected[i] instanceof Node && selected[i].size != default_size ) ) v_size = -1;
						}
						updateSliders( v_size == -1 ? default_size : v_size, v_width == -1 ? default_width : v_width );
					}
				}
				draw_all();

				//Maintain position relative to mouse position for moving multiple elements
				relative_pos = [];
				for(i = 0; i < selected.length; i++) {
					 //Make sure we don't try to set the position of links (whose position is defined by their parent nodes only)
					if( selected[i] instanceof Link ) {
						relative_pos.push( null );
						continue;
					}

					var r = rel_pos( selected[i].position );
					relative_pos.push( [ r[0] - mouse_position[0] / grid_size, r[1] - mouse_position[1] / grid_size] );
				}
			} else {
				//Prevent creating new nodes on top of old ones
				if( pointInNode( mouse_position ) == null ) {
					var node = new Node( 5, abs_pos( [ mouse_position[0] / grid_size, mouse_position[1] / grid_size ] ), default_size, 0, "", default_width, default_color );
					node.draw();
				}
			}
		} else if( e.which == 3 ) {
			//Initiate a new link on right-click of a node
			rc_down = true;
			var p = pointInNode( mouse_position );
			if( p != null ) {
				new_link = new Link( p, null, default_width, default_color, default_direction );
			}
		}
	};

	//When the mouse button is released
	canvas.onmouseup = function(e) {
		if( e.which == 1 ) {
			lc_down = false;

			console.log( mouse_position );
			if( !pointInNode( mouse_position ) && !pointInLink( mouse_position ) ) deselect_all();
			draw_all();
		} else if( e.which == 3 ) {
			rc_down = false;

			//Dragging of a new link
			//If the user hovers over a node, the link snaps to that node
			if( new_link != null ) {
				var p = pointInNode( mouse_position );
				if( p == null ) {
					new_link.delete();
				} else {
					new_link.node_two = p;
					new_link.position_override = null;
					new_link = null;
				}
				draw_all();
			} else if( selected.length > 0 ) { //Changing direction of links
				var link = pointInLink( mouse_position );
				if( link != null ) {
					for(i = 0; i < selected.length; i++) {
						if( selected[i].index == link.index ) {
							link.direction++;
							if( link.direction > 2 ) link.direction = -1;
							default_direction = link.direction;
							draw_all();

							break;
						}
					}
				}
			}
		}
	}

	//While the cursor is being moved
	canvas.onmousemove = function(e) {
		//We have to constantly update a global variable with the position of the mouse in order to be able to use it in other functions
		mouse_position = [e.offsetX, e.offsetY];

		//Dragging the grid
		if( space_down ) { nav_drag(e); }


		if( lc_down ) {
			if( selected.length == 0 ) return;
			else if( selected.length == 1 && selected[0] instanceof Link ) {
				var pos_n1 = rel_screen_pos( selected[0].node_one.position );
				var pos_n2 = rel_screen_pos( selected[0].node_two.position );

				var v = vecProj( pos_n1, pos_n2, mouse_position );
				if( ( v[2] > 0 && v[2] < dist( pos_n1, pos_n2 ) ) && v[3] < 20 ) { selected[0].arc_point = null; }
				else { selected[0].arc_point = abs_pos( [ mouse_position[0] / grid_size, mouse_position[1] / grid_size ] ); }
			} else {
				//Moving a node:
				//Adjust all of the selected nodes using their initial relative positions to the mouse position (maintaining their own relative position)
				for(j = 0; j < selected.length; j++) {
					if( !relative_pos[j] ) continue;
					selected[j].setPos( [ mouse_position[0] / grid_size + relative_pos[j][0], mouse_position[1] / grid_size + relative_pos[j][1] ] );
				}
			}
			updateInfo( selected[0], selected.length > 1 );
			draw_all();
		} else if( rc_down && new_link != null ) {
			new_link.setPositionOverride( mouse_position );

			draw_all();
		}
	};

	window.addEventListener( "keydown", function(e) {
		if( e.keyCode == 16 || e.keyCode == 17 ) {
			shift = e.keyCode == 16;
			ctrl = e.keyCode == 17;
			return;
		}
		if( selected.length == 0 ) { return; }

		var code = e.keyCode;

		if( code == 46 ) {
			for(j = 0; j < selected.length; j++ ) selected[j].delete();
			selected = [];
		} else {
			var lower_vals = { 219:91, 221:93, 189:45, 187:61, 192:96, 220:92, 186:59, 222:39, 188:44,
				190:46, 191:47 };
			var shift_vals = { 48:41, 49:33, 50:64, 51:35, 52:36, 53:37, 54:94, 55:38, 56:42,
				57:40, 219:123, 221:125, 189:95, 187:43, 192:126, 220:124, 186:58, 222:34, 188:60,
			 	190:62, 191:63 };

			if( code == 8 ) {
				for(i = 0; i < selected.length; i++ ) selected[i].text = selected[i].text.substring( 0, selected[i].text.length - 1 );
			} else {
				if( shift ) {
					if( code in shift_vals ) code = shift_vals[ code ];
				} else {
					if( code >= 65 && code <= 90 ) { code += 32; }
					else {
						if( code in lower_vals ) code = lower_vals[ code ];
					}
				}

				for(i = 0; i < selected.length; i++ ) selected[i].text += String.fromCharCode( code );
			}
		}

		draw_all();
	}, false);
	window.addEventListener( "keyup", function(e) {
		if( e.keyCode == 16 || e.keyCode == 17 ) {
			shift = e.keyCode == 16 ? false : shift;
			ctrl = e.keyCode == 17 ? false : ctrl;
			return;
		}
	}, false );

	//Zoom functionality
	function changeZoom( new_size, pos ) {
		//Calculate the new grid size (zoom)
		new_size = clamp( new_size, 5, 100 );

		//Calculate viewport offset when zooming
		//(I don't really know exactly how this works xd)
		var m_pos = abs_pos( [ pos[0] / grid_size, pos[1] / grid_size ] );
		viewport = [ ( viewport[0] * grid_size + m_pos[0] * ( new_size - grid_size ) ) / new_size, ( viewport[1] * grid_size + m_pos[1] * ( new_size - grid_size ) ) / new_size ];


		grid_size = new_size;

		updateSliders();
		draw_all();
	}
	window.addEventListener( "mousewheel", function(e) { changeZoom( grid_size + (e.wheelDeltaY / 100), mouse_position ); }, false); //not moz
	window.addEventListener( "DOMMouseScroll", function(e) { changeZoom( grid_size + (e.wheelDeltaY / 100), mouse_position ); }, false); //moz

	//Disable context menu
	canvas.oncontextmenu = function(e) { e.preventDefault(); };



	/*------------------------*\
	| --- SIDEBAR CONTROLS --- |
	\*------------------------*/
	function updateSliders( size_override, width_override, zoom_override ) {
		var size = size_override || default_size;
		var width = width_override || default_width;
		var zoom = zoom_override || grid_size;
		zoom = Math.round( zoom * 10 ) / 10;

		document.getElementById( "nodesize_slider" ).value = size;
		document.getElementById( "nodesize_text" ).value = size;

		document.getElementById( "linewidth_slider" ).value = Math.floor( width * 50 );
		document.getElementById( "linewidth_text" ).value = Math.floor( width * 50 );

		document.getElementById( "zoom_slider" ).value = zoom;
		document.getElementById( "zoom_text" ).value = zoom;
	}
	function updateInfo( elem, undef, none ) {
		undef = ( undef == undefined ? false : undef );
		none = ( none == undefined ? false : none );

		var abspos = document.getElementById( "info_abspos" );
		var relpos = document.getElementById( "info_relpos" );
		var index = document.getElementById( "info_index" );
		var type = document.getElementById( "info_type" );

		if( !none ) {
			if( !undef ) {
				if( elem instanceof Node ) {
					abspos.innerHTML = "pos (abs): <strong>[" + elem.position[0] + ", " + elem.position[1] + "]</strong>";
					relpos.innerHTML = "pos (rel): <strong>[" + Math.floor( rel_pos(elem.position)[0] ) + ", " + Math.floor( rel_pos(elem.position)[1] ) + "]</strong>";
					index.innerHTML = "index: <strong>" + elem.index + "</strong>";
					type.innerHTML = "type: <strong>Node</strong>";
				} else if( elem instanceof Link ) {
					abspos.innerHTML = "pos (abs): <strong>N/A</strong>";
					relpos.innerHTML = "pos (rel): <strong>N/A</strong>";
					index.innerHTML = "index: <strong>" + elem.index + "</strong>";
					type.innerHTML = "type: <strong>Link</strong>"
				}
			} else {
				abspos.innerHTML = "pos (abs): <strong>(multiple)</strong>";
				relpos.innerHTML = "pos (rel): <strong>(multiple)</strong>";
				index.innerHTML = "index: <strong>(multiple)</strong>";
				type.innerHTML = "type: <strong>(multiple)</strong>";
			}
		} else {
			abspos.innerHTML = "pos (abs): ";
			relpos.innerHTML = "pos (rel): ";
			index.innerHTML = "index: ";
			type.innerHTML = "type: ";
		}
	}

	document.getElementById( "nodesize_slider" ).addEventListener( 'input', function() {
		default_size = document.getElementById( "nodesize_slider" ).value || 3;
		document.getElementById( "nodesize_text" ).value = default_size;

		if( selected.length > 0 ) {
			for(i = 0; i < selected.length; i++ )
			if( selected[i] instanceof Node ) selected[i].size = default_size;
			draw_all();
 		}
	});
	document.getElementById( "linewidth_slider" ).addEventListener( 'input', function() {
		var value = document.getElementById( "linewidth_slider" ).value || 5;
		document.getElementById( "linewidth_text" ).value = value;
		default_width = value / 50;

		if( selected.length > 0 ) {
			for(i = 0; i < selected.length; i++) {
				if(selected[i] instanceof Node) selected[i].outline_width = default_width;
				else if( selected[i] instanceof Link) selected[i].width = default_width;
			}
			draw_all();
		}
	});
	document.getElementById( "zoom_slider" ).addEventListener( 'input', function() {
		var new_size = document.getElementById( "zoom_slider" ).value || 20;
		document.getElementById( "zoom_text" ).value = new_size;

		changeZoom( new_size, [ canvas.width * 0.5, canvas.height * 0.5 ] );
	});
	document.querySelector( "#nodesize .slider_all" ).addEventListener( "click", function() {
		for(i = 0; i < nodes.length; i++ ) {
			if( !nodes[i] ) continue;
			nodes[i].size = default_size;
		}
		draw_all();
	});
	document.querySelector( "#nodesize .slider_reset" ).addEventListener( "click", function() {
		default_size = 3;
		updateSliders();

		if( selected.length > 0 ) {
			for(i = 0; i < selected.length; i++ )
			if( selected[i] instanceof Node ) selected[i].size = default_size;
			draw_all();
 		}
	});
	document.querySelector( "#linewidth .slider_all" ).addEventListener( "click", function() {
		for(i = 0; i < nodes.length; i++ ) {
			if( !nodes[i] ) continue;
			nodes[i].outline_width = default_width;
		}
		for(i = 0; i < links.length; i++ ) {
			if( !links[i] ) continue;
			links[i].width = default_width;
		}
		draw_all();
	});
	document.querySelector( "#linewidth .slider_reset" ).addEventListener( "click", function() {
		default_width = 2;
		updateSliders();

		if( selected.length > 0 ) {
			for(i = 0; i < selected.length; i++) {
				if(selected[i] instanceof Node) selected[i].outline_width = default_width;
				else if( selected[i] instanceof Link) selected[i].width = default_width;
			}
			draw_all();
		}
	});
	document.getElementById( "linecolor_input" ).addEventListener( "input", function() {
		default_color = document.getElementById( "linecolor_input" ).value || "#000000";

		if( selected.length > 0 ) {
			for(i = 0; i < selected.length; i++ ) {
				if( selected[i] instanceof Node ) selected[i].outline_color = default_color;
				else if( selected[i] instanceof Link ) selected[i].color = default_color;
			}
			draw_all();
		}
	});

	var checkbox = document.querySelector('#gridlines');
    checkbox.addEventListener('change', function (e) {
		settings_theme = checkbox.checked ? 1 : 3;
		draw_all();
    });

	draw_all();
})();

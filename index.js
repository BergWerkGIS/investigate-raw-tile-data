var http = require('http');
var https = require('https');
var url = require('url');
var path = require('path');
var fs = require('fs');
var Pbf = require('pbf');
var vt = require('vector-tile');
var zlib = require('zlib');
var mapnik = require('mapnik');

var token = process.env.MAPBOX_ACCESS_TOKEN;
if (!token) {
	console.error("MAPBOX_ACCESS_TOKEN not set.");
	console.error("use SET MAPBOX_ACCESS_TOKEN= or export MAPBOX_ACCESS_TOKEN=");
	process.exit(1);
}

var server = http.createServer();
var port = process.argv[2] || 666;

server.listen(port);

var no_cache_hdr = {
	'Cache-Control': 'no-cache, no-store, must-revalidate',
	'Pragma': 'no-cache',
	'Expires': 0
}

server.on('request', function (req, res) {
	var uri = url.parse(req.url).pathname;
	var filename = path.join(__dirname, uri);
	fs.exists(filename, function (exists) {

		console.log('local req.url:', req.url);
		//static files
		if (
			-1 === filename.indexOf('.webp')
			&& -1 === filename.indexOf('.pbf')
		) {
			var isHtml = filename.indexOf('.html') >= 0;
			var mode = isHtml ? 'utf8' : 'binary';
			//var mode = isHtml ? null : 'binary';
			fs.readFile(filename, mode, function (err, file) {
				if (isHtml) {
					file = file.replace(/MAPBOX_ACCESS_TOKEN/g, token);
				}
				res.writeHead(200, no_cache_hdr);
				res.write(file, mode);
				res.end();
				return;
			});
		} else {
			var zxy = req.url.match(/\/(\d+)\/(\d+)\/(\d+)/);
			var z = +zxy[1];
			var x = +zxy[2];
			var y = +zxy[3]
			var simplify_distance = 10.0;

			var url_parts = url.parse(req.url, true);
			var query = url_parts.query;
			var tile_url = `https://api.tiles.mapbox.com/v4/${query.ts}/${z}/${x}/${y}.vector.pbf?access_token=${token}`;
			https.get(tile_url, (response) => {
				const statusCode = res.statusCode;
				let error;
				if (statusCode !== 200) {
					error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
				}
				if (error) {
					console.log(error.message);
					// consume response data to free up memory
					response.resume();
					return;
				}
				let rawData = [];
				response.on('data', (chunk) => rawData.push(chunk));
				response.on('end', () => {
					try {
						if (response.statusCode !== 200) {
							res.writeHead(response.statusCode, no_cache_hdr);
							res.end();
							return;
						}

						//at this point data is an array of Buffers
						//so Buffer.concat() can make us a new Buffer
						//of all of them together
						var file = Buffer.concat(rawData);
						zlib.gunzip(file, function (err, data) {
							if (err) { throw err; }
							var tile = new mapnik.VectorTile(z, x, y, { buffer_size: 256 });
							tile.setData(file, function (err) {
								if (err) { throw err; }
								var t2 = new mapnik.VectorTile(z, x, y, { buffer_size: 256 });
								//simplify lower zoom level to not have too detailed geometries
								if (z > 15) { simplify_distance = 0.0; }
								t2.composite([tile], { reencode: true, simplify_distance: simplify_distance });
								var collection = { type: 'FeatureCollection', features: [] };
								t2.paintedLayers().forEach(function (lyr_name) {
									//already returns a featurecollection, e.g.:
									//{"type":"FeatureCollection","name":"b000","features":[{"type":"Feature","id":1,"geometry"
									//console.log(tile.toGeoJSON(lyr_name).features);
									var feats = JSON.parse(t2.toGeoJSON(lyr_name)).features;
									feats.forEach(function (feat) {
										feat.properties.lyr = lyr_name;
										feat.properties.tid = `${z}/${x}/${y}`;
										collection.features.push(feat);
									});
								})

								res.writeHead(200, { "Content-Type": "application/vnd.geo+json" });
								res.write(JSON.stringify(collection));
								res.end();
							});
						});
					} catch (e) {
						console.log(e.message);
					}
				});
			}).on('error', (e) => {
				console.log(`Got error: ${e.message}`);
			});
		}
	});
});


server.on('listening', function () {
	console.log('open browser at http://localhost:' + port + '/show-tiles.html');
});

server.on('error', function (err) {
	console.log(err);
});
#r System.Drawing

using System.Drawing;
public PointF WorldToTilePos(double lon, double lat, int zoom)
{
	PointF p = new Point();
	p.X = (float)((lon + 180.0) / 360.0 * (1 << zoom));
	p.Y = (float)((1.0 - Math.Log(Math.Tan(lat * Math.PI / 180.0) + 
		1.0 / Math.Cos(lat * Math.PI / 180.0)) / Math.PI) / 2.0 * (1 << zoom));
		
	return p;
}

public PointF TileToWorldPos(double tile_x, double tile_y, int zoom) 
{
	PointF p = new Point();
	double n = Math.PI - ((2.0 * Math.PI * tile_y) / Math.Pow(2.0, zoom));

	p.X = (float)((tile_x / Math.Pow(2.0, zoom) * 360.0) - 180.0);
	p.Y = (float)(180.0 / Math.PI * Math.Atan(Math.Sinh(n)));

	return p;
}

Console.WriteLine(TileToWorldPos(2157,1439,12));
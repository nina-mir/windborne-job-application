# A data visualization project ingesting data from the Live Constellation API of WindBorne Systems

## This work was developed as part of a job application to WindBorne Systems 



> The task asked all the job applicants to use the blind data fetched from the WindBorne Systems Live Constellation API tracking the hourly coordinates (latitude, longitude & altitude) of 1000 sounding balloons flying over Earth in a web project. The Web project was to mix the WindBorne API with another API and create something cool!  

### My Thoughts

Using the given API endpoint of https://a.windbornesystems.com/treasure/00.json to retrieve the current locations of the balloons, one would receive the JSON file with the followins data:

<pre>
[
  [37.6168991698667, -39.9614566202007, 16.8164763882686],
  [57.8309855259096, 110.751264343258, 5.38459441598974],
  [-77.5896204621644, 115.195536287125, 17.8230573983555],
  [7.34685984931652, -4.38304481895347, 16.8447728717081],
  ... 
]

{1000 total locations in each file}

</pre>

#### client-side

I decided to use the following two geocoding APIs to figure out the geographical location of the balloons at any given time:
- http://api.geonames.org/extendedFindNearbyJSON
- https://nominatim.openstreetmap.org/reverse 

> [!NOTE]
> Nominatim, a geocoding tool for OpenStreetMap (OSM) data, does not provide much info about the geolocations in the vast oceans. In such cases, I utilized the free, collaborative databse GeoNames.

Using the above APIs, I found out the names of any body of water or country that the balloons were flying over. However, none of the above APIs had any info about different polar regions or uninhabited islands in the vast oceans. In such cases, I used "unknown" to indicate the lack of precise info.

Eventually, I decided to create two dynamically updated data visualizations with the processed/obtained data:

- A world map of trajectories of each balloon in 24 hours
- A sankey chart displaying the starting point and the ending point of each balloon in a 24-hr interval.

> My goal of creating the above DataViz prototypes was to showcase the different methods of inferring useful info from the WindBorne API data. 

#### backend

The final challenge in this work was designing a backend system to automatically fetch new data, archive old data, process the new data and cache them via Cloudflare Workers for the client-side service to utilize them. 

I decided to configure an Ubuntu OS coud server (a cheap DigitalOcean droplet server $6/month). Using a SQLite database to store all the geocoded info in parallel with a geocoding API service, I processed the new data and pushed it to a remote repo on GitHub to store the archived data and current data. This work got automated using a Cron job on Ubuntu OS. At the same time, using a free-tier Cloudflare Worker allowed me to avoid throttling the request cap of GitHub RawData API endpoint which is very limited per hour. Cloudflare Worker allows up to 3000+ GET requests of a cached data for the free-tier fortunately.

The backend code and the continuously automated data/current/archive can be viwed here:


https://github.com/nina-mir/automated-data-ops






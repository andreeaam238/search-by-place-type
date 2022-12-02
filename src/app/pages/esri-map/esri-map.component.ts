/*
  Copyright 2019 Esri
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
} from "@angular/core";
import { setDefaultOptions, loadModules } from "esri-loader";
import { Point } from "esri/geometry";
import esri = __esri; // Esri TypeScript Types

@Component({
  selector: "app-esri-map",
  templateUrl: "./esri-map.component.html",
  styleUrls: ["./esri-map.component.scss"],
})
export class EsriMapComponent implements OnInit, OnDestroy {
  @Output() mapLoadedEvent = new EventEmitter<boolean>();

  // The <div> where we will place the map
  @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

  // register Dojo AMD dependencies
  _Map;
  _MapView;
  _FeatureLayer;
  _Graphic;
  _GraphicsLayer;
  _Route;
  _RouteParameters;
  _FeatureSet;
  _Point;
  _locator;

  // Instances
  map: esri.Map;
  view: esri.MapView;
  pointGraphic: esri.Graphic;
  graphicsLayer: esri.GraphicsLayer;

  // Attributes
  zoom = 10;
  center: Array<number> = [-118.73682450024377, 34.07817583063242];
  basemap = "arcgis-navigation";
  loaded = false;
  pointCoords: number[] = [-118.73682450024377, 34.07817583063242];
  dir: number = 0;
  count: number = 0;
  timeoutHandler = null;

  constructor() {}

  async initializeMap() {
    try {
      // configure esri-loader to use version x from the ArcGIS CDN
      // setDefaultOptions({ version: '3.3.0', css: true });
      setDefaultOptions({ css: true });

      // Load the modules for the ArcGIS API for JavaScript
      const [
        esriConfig,
        Map,
        MapView,
        FeatureLayer,
        Graphic,
        Point,
        GraphicsLayer,
        route,
        RouteParameters,
        FeatureSet,
        locator,
      ] = await loadModules([
        "esri/config",
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/Graphic",
        "esri/geometry/Point",
        "esri/layers/GraphicsLayer",
        "esri/rest/route",
        "esri/rest/support/RouteParameters",
        "esri/rest/support/FeatureSet",
        "esri/rest/locator",
      ]);

      esriConfig.apiKey =
        "AAPK96c3dc2e11734f96852b9f83319128a7AwtXTcRvExfL9-yYgVLNKW5ONYv3yLXUNbel0FxQySEL4FyIbt1Fuw7njdOAaljf";

      this._Map = Map;
      this._MapView = MapView;
      this._FeatureLayer = FeatureLayer;
      this._Graphic = Graphic;
      this._GraphicsLayer = GraphicsLayer;
      this._Route = route;
      this._RouteParameters = RouteParameters;
      this._FeatureSet = FeatureSet;
      this._Point = Point;
      this._locator = locator;

      // Configure the Map
      const mapProperties = {
        basemap: this.basemap,
      };

      this.map = new Map(mapProperties);

      this.addFeatureLayers();
      this.addPoint(this.pointCoords[1], this.pointCoords[0]);

      // Initialize the MapView
      const mapViewProperties = {
        container: this.mapViewEl.nativeElement,
        center: this.center,
        zoom: this.zoom,
        map: this.map,
      };

      this.view = new MapView(mapViewProperties);

      // Fires `pointer-move` event when user clicks on "Shift"
      // key and moves the pointer on the view.
      this.view.on("pointer-move", ["Shift"], (event) => {
        let point = this.view.toMap({ x: event.x, y: event.y });
        console.log("map moved: ", point.longitude, point.latitude);
      });

      await this.view.when(); // wait for map to load
      console.log("ArcGIS map loaded");
      this.addRouter();
      console.log(this.view.center);

      return this.view;
    } catch (error) {
      console.log("EsriLoader: ", error);
    }
  }

  addFeatureLayers() {
    // Trailheads feature layer (points)
    var trailheadsLayer: __esri.FeatureLayer = new this._FeatureLayer({
      url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trailheads/FeatureServer/0",
    });

    this.map.add(trailheadsLayer);

    // Trails feature layer (lines)

    // Define a unique value renderer and symbols
    const trailsRenderer = {
      type: "simple",
      symbol: {
        color: "#BA55D3",
        type: "simple-line",
        style: "solid",
      },

      visualVariables: [
        {
          type: "size",
          field: "ELEV_GAIN",
          minDataValue: 0,
          maxDataValue: 2300,
          minSize: "3px",
          maxSize: "7px",
        },
      ],
    };

    // Create the layer and set the renderer
    const popupTrails = {
      title: "Trail Information",
      content: [
        {
          type: "media",
          mediaInfos: [
            {
              type: "column-chart",
              caption: "",
              value: {
                fields: ["ELEV_MIN", "ELEV_MAX"],
                normalizeField: null,
                tooltipField: "Min and max elevation values",
              },
            },
          ],
        },
      ],
    };
    const trails = new this._FeatureLayer({
      url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trails_Styled/FeatureServer/0",
      outFields: ["TRL_NAME", "ELEV_GAIN"],
      popupTemplate: popupTrails,
    });

    // Add the layer
    this.map.add(trails, 0);

    // Parks and open spaces (polygons)
    var parksLayer: __esri.FeatureLayer = new this._FeatureLayer({
      url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Parks_and_Open_Space/FeatureServer/0",
    });

    this.map.add(parksLayer, 0);

    // Create the layer and set the renderer
    const popupTrailheads = {
      title: "Trailhead",
      content:
        "<b>Trail:</b> {TRL_NAME}<br><b>City:</b> {CITY_JUR}<br><b>Cross Street:</b> {X_STREET}<br><b>Parking:</b> {PARKING}<br><b>Elevation:</b> {ELEV_FT} ft",
    };
    const trailheads = new this._FeatureLayer({
      url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trailheads_Styled/FeatureServer/0",
      outFields: ["TRL_NAME", "CITY_JUR", "X_STREET", "PARKING", "ELEV_FT"],
      popupTemplate: popupTrailheads,
    });
    this.map.add(trailheads);

    const popupOpenspaces = {
      title: "{PARK_NAME}",
      content: [
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: "AGNCY_NAME",
              label: "Agency",
              isEditable: true,
              tooltip: "",
              visible: true,
              format: null,
              stringFieldOption: "text-box",
            },
            {
              fieldName: "TYPE",
              label: "Type",
              isEditable: true,
              tooltip: "",
              visible: true,
              format: null,
              stringFieldOption: "text-box",
            },
            {
              fieldName: "ACCESS_TYP",
              label: "Access",
              isEditable: true,
              tooltip: "",
              visible: true,
              format: null,
              stringFieldOption: "text-box",
            },

            {
              fieldName: "GIS_ACRES",
              label: "Acres",
              isEditable: true,
              tooltip: "",
              visible: true,
              format: {
                places: 2,
                digitSeparator: true,
              },

              stringFieldOption: "text-box",
            },
          ],
        },
      ],
    };

    function createFillSymbol(value, color) {
      return {
        value: value,
        symbol: {
          color: color,
          type: "simple-fill",
          style: "solid",
          outline: {
            style: "none",
          },
        },
        label: value,
      };
    }

    const openSpacesRenderer = {
      type: "unique-value",
      field: "TYPE",
      uniqueValueInfos: [
        createFillSymbol("Natural Areas", "#9E559C"),
        createFillSymbol("Regional Open Space", "#A7C636"),
        createFillSymbol("Local Park", "#149ECE"),
        createFillSymbol("Regional Recreation Park", "#ED5151"),
      ],
    };

    const openspaces = new this._FeatureLayer({
      url: "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Parks_and_Open_Space_Styled/FeatureServer/0",
      outFields: [
        "TYPE",
        "PARK_NAME",
        "AGNCY_NAME",
        "ACCESS_TYP",
        "GIS_ACRES",
        "TRLS_MI",
        "TOTAL_GOOD",
        "TOTAL_FAIR",
        "TOTAL_POOR",
      ],
      popupTemplate: popupOpenspaces,
    });

    this.map.add(openspaces, 0);

    console.log("feature layers added");
  }

  addPoint(lat: number, lng: number) {
    this.graphicsLayer = new this._GraphicsLayer();
    this.map.add(this.graphicsLayer);
    const point = {
      //Create a point
      type: "point",
      longitude: lng,
      latitude: lat,
    };
    const simpleMarkerSymbol = {
      type: "simple-marker",
      color: [226, 119, 40], // Orange
      outline: {
        color: [255, 255, 255], // White
        width: 1,
      },
    };
    this.pointGraphic = new this._Graphic({
      geometry: point,
      symbol: simpleMarkerSymbol,
    });
    this.graphicsLayer.add(this.pointGraphic);

    const polyline = {
      type: "polyline",
      paths: [
        [-118.821527826096, 34.0139576938577], //Longitude, latitude
        [-118.814893761649, 34.0080602407843], //Longitude, latitude
        [-118.808878330345, 34.0016642996246], //Longitude, latitude
      ],
    };
    const simpleLineSymbol = {
      type: "simple-line",
      color: [226, 119, 40], // Orange
      width: 2,
    };

    const polylineGraphic = new this._Graphic({
      geometry: polyline,
      symbol: simpleLineSymbol,
    });
    this.graphicsLayer.add(polylineGraphic);
  }

  removePoint() {
    if (this.pointGraphic != null) {
      this.graphicsLayer.remove(this.pointGraphic);
    }
  }

  findPlaces(category: string, pt: Point) {
    if (category === "Choose a place type...") {
      return;
    }

    const geocodingServiceUrl =
      "http://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";

    const params = {
      location: pt,
      categories: [category],
      maxLocations: 25,
      outFields: ["Place_addr", "PlaceName"],
    };

    const showResults = (results) => {
      this.view.popup.close();
      this.view.graphics.removeAll();

      results.forEach((result) => {
        this.view.graphics.add(
          new this._Graphic({
            attributes: result.attributes,
            geometry: result.location,
            symbol: {
              type: "simple-marker",
              color: "black",
              size: "10px",
              outline: {
                color: "#ffffff",
                width: "2px",
              },
            },
            popupTemplate: {
              title: "{PlaceName}",
              content:
                "{Place_addr}" +
                "<br><br>" +
                result.location.x.toFixed(5) +
                "," +
                result.location.y.toFixed(5),
            },
          })
        );
      });

      if (results.length) {
        const g = this.view.graphics.getItemAt(0);
        this.view.popup.open({
          features: [g],
          location: g.geometry,
        });
      }
    };

    this._locator
      .addressToLocations(geocodingServiceUrl, params)
      .then((results) => {
        showResults(results);
      })
      .catch((err) => console.warn(err));
  }

  addRouter() {
    const routeUrl =
      "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

    this.view.on("click", (event) => {
      console.log(
        "point clicked: ",
        event.mapPoint.latitude,
        event.mapPoint.longitude
      );
      if (this.view.graphics.length === 0) {
        addGraphic("origin", event.mapPoint);
      } else if (this.view.graphics.length === 1) {
        addGraphic("destination", event.mapPoint);
        getRoute(); // Call the route service
      } else {
        this.view.graphics.removeAll();
        addGraphic("origin", event.mapPoint);
      }
    });

    var addGraphic = (type: any, point: any) => {
      const graphic = new this._Graphic({
        symbol: {
          type: "simple-marker",
          color: type === "origin" ? "white" : "black",
          size: "8px",
        } as any,
        geometry: point,
      });
      this.view.graphics.add(graphic);
    };

    var getRoute = () => {
      const routeParams = new this._RouteParameters({
        stops: new this._FeatureSet({
          features: this.view.graphics.toArray(),
        }),
        returnDirections: true,
      });

      this._Route
        .solve(routeUrl, routeParams)
        .then((data: any) => {
          for (let result of data.routeResults) {
            result.route.symbol = {
              type: "simple-line",
              color: [5, 150, 255],
              width: 3,
            };
            this.view.graphics.add(result.route);
          }

          // Display directions
          if (data.routeResults.length > 0) {
            const directions: any = document.createElement("ol");
            directions.classList =
              "esri-widget esri-widget--panel esri-directions__scroller";
            directions.style.marginTop = "0";
            directions.style.padding = "15px 15px 15px 30px";
            const features = data.routeResults[0].directions.features;

            let sum = 0;
            // Show each direction
            features.forEach((result: any, i: any) => {
              sum += parseFloat(result.attributes.length);
              const direction = document.createElement("li");
              direction.innerHTML =
                result.attributes.text +
                " (" +
                result.attributes.length +
                " miles)";
              directions.appendChild(direction);
            });

            sum = sum * 1.609344;
            console.log("dist (km) = ", sum);

            this.view.ui.empty("top-right");
            this.view.ui.add(directions, "top-right");
          }
        })
        .catch((error: any) => {
          console.log(error);
        });
    };
  }

  runTimer() {
    this.timeoutHandler = setTimeout(() => {
      // code to execute continuously until the view is closed
      // ...
      this.animatePointDemo();
      this.runTimer();
    }, 200);
  }

  animatePointDemo() {
    this.removePoint();
    switch (this.dir) {
      case 0:
        this.pointCoords[1] += 0.01;
        break;
      case 1:
        this.pointCoords[0] += 0.02;
        break;
      case 2:
        this.pointCoords[1] -= 0.01;
        break;
      case 3:
        this.pointCoords[0] -= 0.02;
        break;
    }

    this.count += 1;
    if (this.count >= 10) {
      this.count = 0;
      this.dir += 1;
      if (this.dir > 3) {
        this.dir = 0;
      }
    }

    // this.addPoint(this.pointCoords[1], this.pointCoords[0]);
  }

  stopTimer() {
    if (this.timeoutHandler != null) {
      clearTimeout(this.timeoutHandler);
      this.timeoutHandler = null;
    }
  }

  ngOnInit() {
    // Initialize MapView and return an instance of MapView
    this.initializeMap().then(() => {
      // The map has been initialized
      console.log("mapView ready: ", this.view.ready);
      this.loaded = this.view.ready;

      const places = [
        "Choose a place type...",
        "Parks and Outdoors",
        "Coffee shop",
        "Gas station",
        "Food",
        "Hotel",
      ];

      const select = document.createElement("select");
      select.setAttribute("class", "esri-widget esri-select");
      select.setAttribute(
        "style",
        "width: 175px; font-family: 'Avenir Next W00'; font-size: 1em"
      );

      places.forEach((p) => {
        const option = document.createElement("option");
        option.value = p;
        option.innerHTML = p;
        select.appendChild(option);
      });

      this.view.ui.add(select, "bottom-right");

      // Search for places in center of map
      this.view.watch("stationary", (val) => {
        if (val) {
          this.findPlaces(select.value, this.view.center);
        }
      });

      // Listen for category changes and find places
      select.addEventListener("change", (event) => {
        this.findPlaces(
          (<HTMLSelectElement>event.target).value,
          this.view.center
        );
      });

      this.mapLoadedEvent.emit(true);
      this.runTimer();
    });
  }

  ngOnDestroy() {
    if (this.view) {
      // destroy the map view
      this.view.container = null;
    }
    this.stopTimer();
  }
}

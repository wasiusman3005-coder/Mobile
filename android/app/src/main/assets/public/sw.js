/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "feacbc15201f9a11871f97d536c121b6"
  }, {
    "url": "pwa-512x512.png",
    "revision": "c6f870fd6812dd968b5640371ac58392"
  }, {
    "url": "pwa-192x192.png",
    "revision": "054beebbac98a03a4c502c393422524d"
  }, {
    "url": "index.html",
    "revision": "4bf15662eedcc0a9ccf44bc324bf1601"
  }, {
    "url": "icon.svg",
    "revision": "fb188e33b292aced0e4bafba603c9f13"
  }, {
    "url": "favicon.ico",
    "revision": "6376ec2fa4e7211b76704744496c9247"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "30d5c24e536f8cd8951140a9e1a7a38c"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/three-vendor-C9DtsGxh.js",
    "revision": null
  }, {
    "url": "assets/rolldown-runtime-WkwZ5CU-.js",
    "revision": null
  }, {
    "url": "assets/react-vendor-DsbKag4k.js",
    "revision": null
  }, {
    "url": "assets/index-urRBW2oi.js",
    "revision": null
  }, {
    "url": "assets/index-BO2pMhPc.css",
    "revision": null
  }, {
    "url": "assets/aistudio/vector-hud-gui-interface-004_e93adaf2.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images_ea059939.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images_cee872ab.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images_be3c8b70.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images__5__ddc17e2d.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images__4__27575c52.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images__3__0fd67f24.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images__2__c5f03e7f.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images__1__d271a28a.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/images_79a73411.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-13_162243_eaddbe9a.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-13_162243_4bb692fd.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-12_121043_f0f3612d.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Gemini_Generated_Image_dmgqqudmgqqudmgq_727c6946.jpg",
    "revision": null
  }, {
    "url": "assets/aistudio/Gemini_Generated_Image_55uicz55uicz55ui_f744178a.jpg",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "30d5c24e536f8cd8951140a9e1a7a38c"
  }, {
    "url": "favicon.ico",
    "revision": "6376ec2fa4e7211b76704744496c9247"
  }, {
    "url": "icon.svg",
    "revision": "fb188e33b292aced0e4bafba603c9f13"
  }, {
    "url": "pwa-192x192.png",
    "revision": "054beebbac98a03a4c502c393422524d"
  }, {
    "url": "pwa-512x512.png",
    "revision": "c6f870fd6812dd968b5640371ac58392"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "feacbc15201f9a11871f97d536c121b6"
  }, {
    "url": "manifest.webmanifest",
    "revision": "959f6461bfc140b4a24766e5a7b0832c"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));

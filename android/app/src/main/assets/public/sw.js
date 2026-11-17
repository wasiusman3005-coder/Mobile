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
    "revision": "2981efb617f6a522afe276956f523370"
  }, {
    "url": "pwa-512x512.png",
    "revision": "35377611ca6ab0cd955f98c86fc6589d"
  }, {
    "url": "pwa-192x192.png",
    "revision": "cc5fbacf7aaf1500765faacd11047a33"
  }, {
    "url": "oneui9-icon.svg",
    "revision": "14507865fd8af864ce3eb501b8fdee4e"
  }, {
    "url": "oneui9-icon.png",
    "revision": "d4f2384b9c7fd9b7bdf8d333a42545cc"
  }, {
    "url": "index.html",
    "revision": "2317504ecec6141c824e607eb620813c"
  }, {
    "url": "icon.svg",
    "revision": "093b87d307d2a781c2be47deced68252"
  }, {
    "url": "favicon.ico",
    "revision": "8649f121a1b9d0d86535166a8a7e8aca"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "4877bc591cfa80be365248f6ec6c8129"
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
    "url": "assets/react-vendor-B9PhsqW7.js",
    "revision": null
  }, {
    "url": "assets/index-DWBDdvsJ.css",
    "revision": null
  }, {
    "url": "assets/index-CuIZO3C3.js",
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
    "url": "assets/aistudio/image_9ae4cbd1.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_9ac1c8df.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_6088a2a7.png",
    "revision": null
  }, {
    "url": "assets/aistudio/image_3d607543.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-16_154610_f2b815e9.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-16_154610_cc1a0762.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-16_154610_c683034e.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-16_154610_3db48aec.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-16_154610_2cc50839.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-13_162243_f4430d25.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-13_162243_eaddbe9a.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-13_162243_65c18fd3.png",
    "revision": null
  }, {
    "url": "assets/aistudio/Screenshot_2026-11-13_162243_53ea10fd.png",
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
    "revision": "4877bc591cfa80be365248f6ec6c8129"
  }, {
    "url": "favicon.ico",
    "revision": "8649f121a1b9d0d86535166a8a7e8aca"
  }, {
    "url": "icon.svg",
    "revision": "093b87d307d2a781c2be47deced68252"
  }, {
    "url": "pwa-192x192.png",
    "revision": "cc5fbacf7aaf1500765faacd11047a33"
  }, {
    "url": "pwa-512x512.png",
    "revision": "35377611ca6ab0cd955f98c86fc6589d"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "2981efb617f6a522afe276956f523370"
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

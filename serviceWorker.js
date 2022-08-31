// Repository name
var GHPATH = '/CNA-ModelingApp';

// App prefix name
var APP_PREFIX = 'CNA_App';

// The version of the cache. Every time you change any of the files
// you need to change this version (version_01, version_02…). 
// If you don't change the version, the service worker will give your
// users the old files!
var VERSION = 'version_00';

// The files to make available for offline use.
var URLS = [    
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/styles/menu.css`,
  `${GHPATH}/styles/modelingApplication.css`,
  `${GHPATH}/styles/modelingApplicationPrint.css`,
  `${GHPATH}/styles/modelingArea.css`,
  `${GHPATH}/styles/modelingToolbar.css`,
  `${GHPATH}/styles/sidebar.css`,
  `${GHPATH}/src/index.mjs`,
  `${GHPATH}/src/home.mjs`,
  `${GHPATH}/ModelingApp/modelingApp.mjs`,
  `${GHPATH}/ModelingApp/src/entities.mjs`,
  `${GHPATH}/ModelingApp/src/errorMessage.mjs`,
  `${GHPATH}/ModelingApp/src/fullscreen.js`,
  `${GHPATH}/ModelingApp/src/systemEntityManager.mjs`,
  `${GHPATH}/ModelingApp/src/views/detailsSideBar.mjs`,
  `${GHPATH}/ModelingApp/src/views/entitySideBar.mjs`,
  `${GHPATH}/ModelingApp/src/views/ModalDialog.mjs`,
  `${GHPATH}/ModelingApp/src/views/modelingAppMainView.mjs`,
  `${GHPATH}/ModelingApp/src/views/modelingArea.mjs`,
  `${GHPATH}/ModelingApp/src/views/toolbar.js`,
  `${GHPATH}/ModelingApp/src/views/tools/connectionSelectionTools.mjs`,
  `${GHPATH}/ModelingApp/src/views/tools/entitySelectionTools.mjs`
]
## iConverse Chat UI
This project consists of 3 main components:
- `chat-app`: The chat interface, on which users can message with the VA
- `context`: The client specific host context page where an iframe will be created, which points to `chat-app`
- `widget`: The JS and assets needed to init the button, iframe and their CSS on any given host context page

### 1. Setup
- The chat-app is actually an AngularJS + IonicJS Webapp. 
- Download the project's dependencies 
```
cd chat/chat-app
yarn && bower install
```

### 2. Development 
There are two options for hosting the chat interface.

**a) Serve using Gulp + BrowserSync**
- This is suitable if you do not have the iConverse backend running, and want to make modifications to the Chat-UI only. Of course, this will require that an iConverse backend is running in the cloud 
- To install the required node dependencies, 
```
cd iconverse-ui
yarn
```
- To startup the BrowserSync Server, run `gulp serve`
- Navigate to `http://localhost:3001`, which should have the host context page loaded, with the initialized chat button at the lower-right and iframe (triggered upon clicking the chat button)

**b) Serve using Tomcat**
- You can also host the components on tomcat by symlink-ing the `iconverse-ui` folder into the Tomcat webapps folder


### 3. Deployment
**3.1) Configuring Urls**
On the server hosting the chat-app and widget, the following structure is default.
```
iconverse-ui <-- note that chatBaseUrl should point to this folder
 |- chat
     |- chat-app
     |- widget

```
- If the default structure is followed on the server, the only configuration required is to point `chatBaseUrl` on index.html to the correct url on the server (the target directory should contain `chat-app` and `widget`)
- If a custom structure is followed (i.e. the chat-app or widget assets are hosted in separate servers), then you may override these urls using an `env.js`, which is referenced in `index.html` (commented out by default). See documentation in `env.js` for more info.

**3.2) Deploying chat-app & widget assets to the server**
After configuring the URLs, you are ready to upload the components to the server
```
# move to main project root folder
cd ..

# Deploy the chat-app only
./deploy.sh chat-app

# Deploy the widget assets only
./deploy.sh chat-assets
 
# Deploy chat-app, widget and client context (for previewing)
./deploy.sh chat-all
```


### 4. Create minified insert script for use in client host page
- Create the minified and uglified insertion JS code with the `minify` gulp task 
```
gulp minify
```
- This outputs `chat_insert_script.js` in the iconverse-ui project root folder.
- The JS can be inserted into the client's host page to setup the chat widget elements. (note: the widget only loads after the page has been fully loaded, and thus will not block client content)
- Do wrap the JS code in `<script>` tags, before giving it to clients to insert in their HTML source
- Clients should insert the script in the `<head>` section, just before the closing `<head>` tag


### 5. Others
- [Embed Guide & Chat Event API](https://docs.google.com/document/d/18G9sb60ZwHNdCM5cjomexHabUcM8_mFKlR5A6ua8x4Y/edit#)

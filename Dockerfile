FROM tomcat:9.0.16-jre11-slim
MAINTAINER Kok How, Teh <kokhow.teh@taiger.com>
RUN rm -rf /usr/local/tomcat/webapps/docs /usr/local/tomcat/webapps/examples /usr/local/tomcat/webapps/ROOT /usr/local/tomcat/webapps/host-manager /usr/local/tomcat/webapps/manager
#ADD dist/index.html /usr/local/tomcat/webapps/ROOT/index.html
#ADD dist/chat /usr/local/tomcat/webapps/ROOT/ui/chat
ADD dist /usr/local/tomcat/webapps/ui
#ADD env-prod.js /usr/local/tomcat/webapps/ROOT/ui/chat/chat-app/env.js
ADD env-prod.js /usr/local/tomcat/webapps/ui/chat/chat-app/env.js
EXPOSE 8080
CMD ["catalina.sh", "run"]
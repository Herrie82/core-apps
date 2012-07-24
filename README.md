core-apps
=========

Core-apps in Open webOS 1.0 includes the following Enyo 1.0 applications:

* accounts
* calculator
* calendar
* clock
* contacts
* email
* memos

Installation Steps
==================

1. Get the core-apps zip file.
2. Get the installation directory path specified in the LunaSysMgr configuration file and install the un-zipped core-apps in that location.
3. Install the Enyo 1.0 framework.
4. Make sure that the application's main index.html is pointing to the correct location. If necessary, modify the index.html file.
5. Start SysMgr
6. Start core-apps

Dependencies
============

Note: LunaSysMgr must be running in order to launch the core applications. 

Core-apps have the following dependencies:

* Enyo Framework 1.0: https://github.com/enyojs
* app-services https://github.com/openwebos/app-services are the services for the core applications contained in Open webOS 1.0. Services include both NodeJS services and C++ services.

Limitations
===========

Note: The following limitations apply to Open webOS 1.0:

* Third-party accounts such as Google, Yahoo, Facebook, etc... are not supported at this time.
* There is no desktop build support.
* You can create imap/pop email accounts.
* You can create local contacts and local calendars. The contacts and calendar events that you create will be stored locally and will not sync and will not sync to any external servers.

Additional Information
======================

* For more information about an individual core-app, refer to the core-app's README.md file.
* For more information about developing Enyo applications, see: https://developer.palm.com/content/api/dev-guide/enyo.html

Copyright and License Information
=================================

All content, including all source code files and documentation files in this repository are: 
Copyright (c) 2011-2012 Hewlett-Packard Development Company, L.P.
All content, including all source code files and documentation files in this repository are: Licensed under the Apache License, Version 2.0 (the "License"); you may not use this content except in compliance with the License. You may obtain a copy of the License at
http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.imloginstate:1"}}'
'''
{"returnValue":true,"results":[]}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.firstlaunch:1"}}'
'''
{
    "returnValue": true,
    "results": [
        {
            "_id": "++Mei96eDNF_Qx4e",
            "_kind": "com.palm.firstlaunch:1",
            "_rev": 20760,
            "_sync": false,
            "appId": "com.palm.app.calendar"
        },
        {
            "_id": "++Mei9X1zxSxbkzG",
            "_kind": "com.palm.firstlaunch:1",
            "_rev": 20801,
            "_sync": false,
            "appId": "com.palm.app.email"
        },
        {
            "_id": "++MenU+OPt4XG01P",
            "_kind": "com.palm.firstlaunch:1",
            "_rev": 44701,
            "_sync": false,
            "appId": {
                "appId": "com.palm.app.messaging"
            }
        },
        {
            "_id": "++MgaZOQdwCmSn88",
            "_kind": "com.palm.firstlaunch:1",
            "_rev": 235254,
            "_sync": false,
            "appId": "com.palm.app.photos"
        },
        {
            "_id": "++MjAv3YKZWq17FQ",
            "_kind": "com.palm.firstlaunch:1",
            "_rev": 486910,
            "_sync": false,
            "appId": "com.palm.app.contacts"
        }
    ]
}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.chatthread:1"}}'
'''
{
    "returnValue": true,
    "results": [
        {
            "_id": "++Mep6jtRl0iYQH8",
            "_kind": "com.palm.chatthread:1",
            "_rev": 363832,
            "_sync": true,
            "displayName": "Friend One",
            "flags": {
                "locked": true,
                "outgoing": false,
                "visible": true
            },
            "normalizedAddress": "zombie1669228244837",
            "personId": null,
            "replyAddress": "+14255553614",
            "replyService": "sms",
            "summary": "Ok I will call you back",
            "timestamp": 1668085785000,
            "unreadCount": 21,
            "unreadCountRevSet": 304111
        },
        {
            "_id": "++Mep7Ek4gZI_004",
            "_kind": "com.palm.chatthread:1",
            "_rev": 363841,
            "_sync": true,
            "displayName": "Friend Two",
            "flags": {
                "locked": true,
                "outgoing": true,
                "visible": true
            },
            "normalizedAddress": "zombie1669228245573",
            "personId": null,
            "replyAddress": "3185555950",
            "replyService": "sms",
            "summary": "Here's a website you might want to vist: http://www.palm.com",
            "timestamp": 1665573350027,
            "unreadCount": 0,
            "unreadCountRevSet": 48869
        },
        {
            "_id": "++MepJwBvWFvC9tQ",
            "_kind": "com.palm.chatthread:1",
            "_rev": 363966,
            "_sync": true,
            "displayName": "Friend Three",
            "flags": {
                "locked": true,
                "outgoing": false,
                "visible": true
            },
            "normalizedAddress": "zombie1669228264480",
            "personId": null,
            "replyAddress": "+12125554746",
            "replyService": "sms",
            "summary": "This is a message from a friend",
            "timestamp": 1668085380000,
            "unreadCount": 13,
            "unreadCountRevSet": 304005
        },
    ]
}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.iminvitation:1"}}'
'''
{"returnValue":true,"results":[]}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.carrierdb.settings.current:1"}}'
    - *might need to try this one on a phone, to get a carrier result*
'''
{"returnValue":true,"results":[]}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.imcommand:1"}}'
'''
{"returnValue":true,"results":[]}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.immessage:1"}}'
'''
{"returnValue":true,"results":[]}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.people:1"}}'
'''
{"errorCode":-3970,"errorText":"kind not registered: 'com.palm.people:1'","returnValue":false}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.tempdb/find '{"query":{"from":"com.palm.imbuddystatus:1"}}'
'''
{"returnValue":true,"results":[]}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.message:1"}}'
'''
{
    "returnValue": true,
    "results": [
        {
            "_id": "++Mep6jenQ+35eDF",
            "_kind": "com.palm.smsmessage:1",
            "_rev": 49054,
            "_sync": true,
            "callbackNumber": "",
            "conversations": [
                "++Mep6jtRl0iYQH8"
            ],
            "flags": {
                "read": true
            },
            "folder": "inbox",
            "from": {
                "addr": "+14407493614"
            },
            "localTimestamp": 1665573216000,
            "messageText": "Here's a message that I received in Conversation A.",
            "networkMsgId": 1,
            "priority": 0,
            "readRevSet": 49054,
            "serviceName": "sms",
            "smsType": 0,
            "status": "successful",
            "timestamp": 1665573216
        },
        {
            "_id": "++Mep6lhILgeIRmD",
            "_kind": "com.palm.smsmessage:1",
            "_rev": 49055,
            "_sync": true,
            "callbackNumber": "",
            "conversations": [
                "++Mep6jtRl0iYQH8"
            ],
            "flags": {
                "read": true
            },
            "folder": "inbox",
            "from": {
                "addr": "+14407493614"
            },
            "localTimestamp": 1665573225000,
            "messageText": "This message is part of Conversation A.",
            "networkMsgId": 1,
            "priority": 0,
            "readRevSet": 49055,
            "serviceName": "sms",
            "smsType": 0,
            "status": "successful",
            "timestamp": 1665573224
        },
        {
            "_id": "++Mep7EVMMV7faXw",
            "_kind": "com.palm.smsmessage:1",
            "_rev": 48870,
            "_sync": true,
            "conversations": [
                "++Mep7Ek4gZI_004"
            ],
            "flags": {
                "deliveryReport": false,
                "visible": true
            },
            "folder": "outbox",
            "localTimestamp": 1665573350027,
            "messageText": "This is a message that is part of conversation B, that I sent.",
            "networkMsgId": 9158,
            "readRevSet": 48859,
            "serviceName": "sms",
            "status": "successful",
            "timestamp": 1665573355,
            "to": [
                {
                    "_id": "bedc",
                    "addr": "5186695950",
                    "name": "Mark Twain"
                }
            ]
        },
    ],
    "next": "1lJ401gfILokGrCEBadfO_RoQ570"
}
'''

# luna-send -n 1 -a com.palm.app.messaging luna://com.palm.db/find '{"query":{"from":"com.palm.person:1"}}'
'''
{
    "returnValue": true,
    "results": [
        {
            "_id": "++MlEAlfWSdsX09d",
            "_kind": "com.palm.person:1",
            "_rev": 738812,
            "addresses": [],
            "anniversary": "",
            "birthday": "",
            "contactIds": [
                "++MlEAlDJxcFshEv"
            ],
            "emails": [
                {
                    "_id": "b4532",
                    "favoriteData": {},
                    "normalizedValue": "personone@gmail.com",
                    "primary": false,
                    "type": "type_other",
                    "value": "personone@gmail.com"
                }
            ],
            "favorite": false,
            "gender": "",
            "ims": [],
            "launcherId": "",
            "name": {
                "familyName": "One",
                "givenName": "Person",
                "honorificPrefix": "",
                "honorificSuffix": "",
                "middleName": ""
            },
            "names": [
                {
                    "_id": "b45fd",
                    "familyName": "One",
                    "givenName": "Person",
                    "honorificPrefix": "",
                    "honorificSuffix": "",
                    "middleName": ""
                }
            ],
            "nickname": "",
            "notes": [],
            "organization": {
                "department": "",
                "description": "",
                "endDate": "",
                "location": {
                    "country": "",
                    "locality": "",
                    "postalCode": "",
                    "primary": false,
                    "region": "",
                    "streetAddress": "",
                    "type": "type_work"
                },
                "name": "",
                "startDate": "",
                "title": "",
                "type": ""
            },
            "phoneNumbers": [
                {
                    "_id": "b4533",
                    "favoriteData": {},
                    "normalizedValue": "-4516176-915-1-+",
                    "primary": false,
                    "speedDial": "",
                    "type": "type_mobile",
                    "value": "+1 (910) 555-6154"
                }
            ],
            "photos": {
                "accountId": "++MlEAhhVjKIZzT2",
                "bigPhotoId": "b4534",
                "bigPhotoPath": "/media/internal/.caldav_photos/ownCloudPersonOne.jpeg",
                "contactId": "++MlEAlDJxcFshEv",
                "listPhotoPath": "/var/file-cache/contactphoto/X/UFt6wCBw.jpeg",
                "listPhotoSource": "type_square",
                "squarePhotoId": "b4535",
                "squarePhotoPath": "/media/internal/.caldav_photos/ownCloudPersonOne.jpeg"
            },
            "relations": [],
            "reminder": "",
            "ringtone": {
                "location": "",
                "name": ""
            },
            "searchTerms": [
                "personone",
                "oneperson"
            ],
            "sortKey": "one\tperson",
            "urls": []
        },
        {
            "_id": "++MlEAlpqK7UKP+i",
            "_kind": "com.palm.person:1",
            "_rev": 738814,
            "addresses": [],
            "anniversary": "",
            "birthday": "",
            "contactIds": [
                "++MlEAlDK04wIDkN"
            ],
            "emails": [
                {
                    "_id": "b4538",
                    "favoriteData": {},
                    "normalizedValue": "ptwo@hotmail.com",
                    "primary": false,
                    "type": "type_other",
                    "value": "ptwo@hotmail.com"
                }
            ],
            "favorite": false,
            "gender": "",
            "ims": [],
            "launcherId": "",
            "name": {
                "familyName": "Two",
                "givenName": "Person",
                "honorificPrefix": "",
                "honorificSuffix": "",
                "middleName": ""
            },
            "names": [
                {
                    "_id": "b45ff",
                    "familyName": "Two",
                    "givenName": "Person",
                    "honorificPrefix": "",
                    "honorificSuffix": "",
                    "middleName": ""
                }
            ],
            "nickname": "",
            "notes": [],
            "organization": {
                "_id": "b4539",
                "department": "",
                "description": "",
                "endDate": "",
                "location": {
                    "country": "",
                    "locality": "",
                    "postalCode": "",
                    "primary": false,
                    "region": "",
                    "streetAddress": "",
                    "type": "type_work"
                },
                "name": "Acme Co",
                "startDate": "",
                "title": "",
                "type": ""
            },
            "phoneNumbers": [
                {
                    "_id": "b453a",
                    "favoriteData": {},
                    "normalizedValue": "-5623874-044-1-+",
                    "primary": false,
                    "speedDial": "",
                    "type": "type_mobile",
                    "value": "+1 444-555-3265"
                }
            ],
            "photos": {
                "accountId": "",
                "bigPhotoId": "",
                "bigPhotoPath": "",
                "contactId": "",
                "listPhotoPath": "",
                "listPhotoSource": "",
                "squarePhotoId": "",
                "squarePhotoPath": ""
            },
            "relations": [],
            "reminder": "",
            "ringtone": {
                "location": "",
                "name": ""
            },
            "searchTerms": [
                "ptwo",
                "persontwo"
            ],
            "sortKey": "two\tperson",
            "urls": []
        }
    ]
}
'''
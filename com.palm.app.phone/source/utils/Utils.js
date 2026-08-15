Utils = {
		
		
}; // namespace

Utils._formatterMcc = 0;
Utils._phoneFormatter = new enyo.g11n.PhoneFmt({
	style: "default",
	mcc: Utils._formatterMcc
});
Utils._dateFormatter = new enyo.g11n.DateFmt({
	date: "short"
});
Utils._timeFormatter = new enyo.g11n.DateFmt({
	time: "short"
});
Utils._dateTimeFormatter = new enyo.g11n.DateFmt({
	date: "short",
	time: "short"
});
Utils._durationShortFormatter = new enyo.g11n.DurationFmt({ 
	style: "short"
});
Utils._durationLongFormatter = new enyo.g11n.DurationFmt({ 
	style: "long"
});
Utils._nameFormatter = new enyo.g11n.NameFmt({
	style: enyo.g11n.Name.longName
});
Utils._geoLocator = new enyo.g11n.GeoLocator({ 
	mcc: Utils._formatterMcc 
});

Utils.mapDialpadChartoNumber = function(c) {
	var key; 
	
	switch (c){
	case 'A':
	case 'a':
	case 'B':
	case 'b':
	case 'C':
	case 'c':
		key = '2';
		break;
		
	case 'D':
	case 'd':
	case 'E':
	case 'e':
	case 'F':
	case 'f':
		key = '3';
		break;
		
	case 'G':
	case 'g':
	case 'H':
	case 'h':
	case 'I':
	case 'i':
		key = '4';
		break;
		
	case 'J':
	case 'j':
	case 'K':
	case 'k':
	case 'L':
	case 'l':
		key = '5';
		break;
		
	case 'M':
	case 'm':
	case 'N':
	case 'n':
	case 'O':
	case 'o':
		key = '6';
		break;
		
	case 'P':
	case 'p':
	case 'Q':
	case 'q':
	case 'R':
	case 'r':
	case 'S':
	case 's':	
		key = '7';
		break;
		
	case 'T':
	case 't':
	case 'U':
	case 'u':
	case 'V':
	case 'v':
		key = '8';
		break;
		
	case 'W':
	case 'w':
	case 'X':
	case 'x':
	case 'Y':
	case 'y':
	case 'Z':
	case 'z':	
		key = '8';
		break;	
		
	default: key = ''; 
	}

	return key;	
};

Utils.PhoneNumberConvertChar = function(number){
	var convertedNumber; 

	for (var i = 0; i < number.length; i++) {
		var c = number[i];
		
		var validNumber = "0123456789";
		if (validNumber.indexOf(number[i]) < 0) {
			c = Utils.mapDialpadChartoNumber(number[i]);
		}
		convertedNumber += c;
	}
	return convertedNumber; 
}; 

Utils.PhoneNumberHasChar = function(number) {
	// return an empty string if passed something invalid
	if (!number || number.length === 0 || typeof number !== "string") {
		return true;
	}
	
	number = number.trim();
	
	switch (number) {
		case "":
		case "unknown":
		case "unknown caller":
		case "blocked":
		case "blocked caller":
			return true; 
	}	
	// skip mmi numbers
	if ( number.indexOf("#") === 0 ) {
		return true;
	}
	
	for (var i = 0; i < number.length; i++) {		
		var validNumber = "0123456789";
		if (validNumber.indexOf(number[i]) < 0) {
			return true; 
		}
	}
	return false; 
}; 

// Format an IM address for display. WhatsApp/Signal ids are +E.164 phone numbers, so format them like
// a phone ("+31 6 2148 9831"); username-style ids (Telegram, Skype, ...) are shown unchanged.
Utils.formatImAddress = function(value) {
	var s = (value === undefined || value === null) ? "" : String(value).trim();
	if (/^\+?[0-9][0-9 ().\-]{5,}$/.test(s)) {
		return Utils.FormatPhoneNumber(s);
	}
	return s;
};

Utils.FormatPhoneNumber = function(number, isPartial) {
	// return an empty string if passed something invalid
	if (!number || number.length === 0 || typeof number !== "string") {
		return "";
	}
	
	number = number.trim();
	
	switch (number) {
		case "":
		case "unknown":
		case "unknown caller":
			return enyo.application.Messages.unknownNumber;
		case "blocked":
		case "blocked caller":
			return enyo.application.Messages.blockedNumber;
	}
	
	// TODO: Work-around for CFISH-5088, remove and test once CFISH-5088 is resolved
	// skip mmi numbers
	if ( number.indexOf("#") === 0 ) {
		return number;
	}
	// TODO: End of CFISH-5088 Work-around

	if (Utils._formatterMcc !== enyo.application.TelephonyStatusInterface.mcc){
		Utils._formatterMcc = enyo.application.TelephonyStatusInterface.mcc;
		Utils._phoneFormatter = new enyo.g11n.PhoneFmt({
			style: "default",
			mcc: Utils._formatterMcc
		});
	}

	return Utils._phoneFormatter.format(new enyo.g11n.PhoneNumber(number, {mcc: Utils._formatterMcc}), {
		partial: isPartial,
		mcc: Utils._formatterMcc
	});
};

// Copied from Contacts.Person#generateDisplayName()
Utils.PersonDisplayName = function(obj) {
	var displayName, fullName;
	enyo.require(obj, "Utils.PersonDisplayName requires an object");
	
	if (obj.name) {
		var name = new enyo.g11n.Name({
			prefix: obj.name.honorificPrefix,
			givenName: obj.name.givenName,
			middleName: obj.name.middleName,
			familyName: obj.name.familyName,
			suffix: obj.name.honorificSuffix
		});
		//var formatter = new enyo.g11n.NameFmt({style: enyo.g11n.Name.longName});
		fullName = Utils._nameFormatter.format(name);
		
		if ( fullName ) {
			displayName = fullName;
		} else if (obj.nickname) {
			displayName = obj.nickname;
		}
	}
	
	if (!displayName && obj.organization) {
		if (obj.organization.title && obj.organization.name) {
			displayName = enyo.application.Utils.interpolate($L("#{title}, #{nm}"), {"title": obj.organization.title, "nm":obj.organization.name});
		} else if (!obj.organization.title && obj.organization.name) {
			displayName = obj.organization.name;
		} else if (obj.organization.title && !obj.organization.name) {
			displayName = obj.organization.title;
		}
	}
	
	if (!displayName) {
		if (obj.emails && obj.emails.length > 0 ) {
			displayName = obj.emails[0].value; 
		} else if (obj.ims && obj.ims.length > 0 ) {
			displayName = obj.ims[0].value;
		} else if (obj.phoneNumbers && obj.phoneNumbers.length > 0 ) {
			displayName = obj.phoneNumbers[0].value;
		} else {
			displayName = $L("[No Name Available]");
		}
	}
	
	return displayName;
};

Utils.PersonGroupName = function(obj) {
	enyo.require(obj, "Utils.PersonDisplayName requires an object");
	var displayName = obj.name.familyName || obj.name.givenName || obj.name.honorificPrefix || obj.name.middleName || obj.name.honorificSuffix;
	
	if (!displayName && obj.organization) {
		displayName = obj.organization.title || obj.organization.name;
	}
	
	if (!displayName) {
		if (obj.emails && obj.emails.length > 0 ) {
			displayName = obj.emails[0].value; 
		} else if (obj.ims && obj.ims.length > 0 ) {
			displayName = obj.ims[0].value;
		} else if (obj.phoneNumbers && obj.phoneNumbers.length > 0 ) {
			displayName = obj.phoneNumbers[0].value;
		} else {
			displayName = $L("#");
		}
	}
	
	return displayName.charAt(0);
};

Utils.getDefaultPhoneNumber = function (contact, bPrefixWithType) {	
	var nPhone = contact.phoneNumbers.length;
	var nPhoneIndex = 0;
	var phoneNum;

	while (nPhoneIndex < nPhone) {
		var phoneNumber = contact.phoneNumbers[nPhoneIndex];
		if (phoneNumber.favoriteData["com.palm.app.phone"]) {
			phoneNum = phoneNumber;
			break;
		}
		nPhoneIndex++;
	}

	if (phoneNum) {
		if (bPrefixWithType === true) {
			var strType = $L("#{type} #{num}");
			return enyo.application.Utils.interpolate(strType, {"type": Utils.getPhoneNumberType(phoneNumber.type), "num": Utils.FormatPhoneNumber(phoneNumber.value)});
		} else {
			return Utils.FormatPhoneNumber(phoneNumber.value);
		}
	}
};

Utils.getSpeedDialNumber = function (contact, speedKey) {
	var len = contact.phoneNumbers.length;
	var nIndex = 0;

	while (nIndex < len) {
		var phoneNumber = contact.phoneNumbers[nIndex];
		if (phoneNumber.speedDial == speedKey) {
			return phoneNumber.value; 
		}
		nIndex++;
	}
	enyo.log("Utils.getSpeedDialNumber error.  Unable to get speeddial number");
	return ""; 	
};

// Collect into imsArray every IM contact-point of this contact that can actually place a call - i.e.
// whose type maps to a registered PHONE-capable transport (whatsapp/telegram/signal/teams/...), not
// one hardcoded service - and return the one the phone app marked as its default, if any.
Utils.getDefaultCallableIms = function(contact, imsArray) {
	var defaultIm = undefined;

	if (contact.ims) {
		var callableTypes = enyo.application.CallSynergizer.getCallableImTypes();
		var len = contact.ims.length;
		for (var i = 0; i < len; i++) {
			var im = contact.ims[i];
			if (callableTypes.indexOf(im.type) === -1) { continue; }
			imsArray.push(im);
			if (im.favoriteData && im.favoriteData["com.palm.app.phone"]) {
				defaultIm = im;
			}
		}
	}

	return defaultIm;
};

Utils.getDefaultContactPoint = function (contact, bPrefixWithType) {
	var callableIMs = [];
	var defaultPhoneNum = enyo.application.Utils.getDefaultPhoneNumber(contact, bPrefixWithType);
	var defaultIm = enyo.application.Utils.getDefaultCallableIms(contact, callableIMs);

	if (defaultPhoneNum) {
		// undefined transport so that if it's a int'l # the user will have the option to use skype (Refer to preferredPhoneService and DialProxy)
		return { "contactPointAddress": defaultPhoneNum, "contactPointTransport": undefined };
	} else if (defaultIm) {
		var imAddress = defaultIm.value;
		if (bPrefixWithType) {
			imAddress = enyo.application.Utils.interpolate($L("#{type} #{IM}"),
				{"type": enyo.application.Utils.imServiceLabel(defaultIm.type), "IM": enyo.application.Utils.formatImAddress(imAddress)});
		}
		// Dial via the IM's OWN service. CallSynergizer.dial() maps a "type_*" serviceName to the
		// account templateId, so this works for any current/future connector.
		return { "contactPointAddress": imAddress, "contactPointTransport": defaultIm.type };
	}

	//note: because contact library does not have picker library ready, we work around to use the first address or
	//phone number in the case there are a multiples.  before: contact.phoneNumbers.length === 1
	if ( contact.phoneNumbers.length >= 1 ) {
		var address;
		if (bPrefixWithType) {
			var addrTemplate = "<b>#{type}</b> <span>#{num}</span>";
			address = enyo.application.Utils.interpolate(addrTemplate, {"type": Utils.getPhoneNumberType(contact.phoneNumbers[0].type), "num": contact.phoneNumbers[0].value});
		} else {
			address = contact.phoneNumbers[0].value;
		}
		return { "contactPointAddress": address, "contactPointTransport": undefined };
	} else if ( callableIMs.length >= 1 ) {
		var address;
		if (bPrefixWithType) {
			var addrTemplate = "<b>#{type}</b> <span>#{IM}</span>";
			address = enyo.application.Utils.interpolate(addrTemplate, {"type": enyo.application.Utils.imServiceLabel(callableIMs[0].type), "IM":enyo.application.Utils.formatImAddress(callableIMs[0].value)});
		} else {
			address = callableIMs[0].value;
		}
		return { "contactPointAddress": address, "contactPointTransport": callableIMs[0].type };
	}
};

Utils.getPhoneNumberType = function(type) {
	if ( enyo.application.Utils.contactPointLabels[type] ) {
		return enyo.application.Utils.contactPointLabels[type][0];
	} else if (type != undefined) {
		return enyo.application.Utils.contactPointLabels["type_mobile"][0];
	} else {
		return "";
	}
};

Utils.keyFromEvent = function(e) {
	enyo.require(e.keyCode, "Utils.keyFromEvent requires an event with keyCode");
	// desktop
	if ( ! window.PalmSystem ) {
		return e.keyCode;
	}
	var hash = JSON.parse(PalmSystem.getDeviceKeys(e.keyCode));
	if ( e.altKey ) {
		return hash.opt;
	} else if ( e.shiftKey ) {
		return hash.shift
	} else {
		return hash.normal;
	};
};


Utils.getKeyBoardType = function() {
	var deviceInfo = window.PalmSystem && JSON.parse(PalmSystem.deviceInfo);
	if (deviceInfo && deviceInfo.keyboardType) {
		if (deviceInfo.keyboardType === 'AZERTY' || deviceInfo.keyboardType === 'AZERTY_FR') {
			return 'AZERTY'; 
		} else if (deviceInfo.keyboardType === 'QWERTZ' || deviceInfo.keyboardType === 'QWERTZ_DE' || deviceInfo.keyboardType === 'QWERTZ_ACC') {
			return 'QWERTZ';
		} else if (deviceInfo.keyboardType === 'QWERTY') {
			return 'QWERTY';
		} else if (deviceInfo.keyboardType === 'AZERTY_ACC') {
			return 'AZERTY_ACC'
		}
	}	
	return undefined;
};


Utils.isDTMFKey = function(c){
	var keyBoardType = Utils.getKeyBoardType();
	switch (keyBoardType) {
		case 'QWERTY':		
		return Utils.isQWERTYDTMFKey(c); 
		
		case 'AZERTY':
		return Utils.isAZERTYDTMFKey(c);
		
		case 'QWERTZ': 
		return Utils.isQWERTZDTMFKey(c);
		
		case 'AZERTY_ACC':
		return Utils.isAZERTYACCDTMFKey(c); 
		
		default: 
		    //we use undefined to check whether it's a virtual keyboard
            if (keyBoardType == undefined) {
                return c;
            } else {
				enyo.log("Utils.isDTMFKey error: unkown physical keyboard type "+keyBoardType);
	    		return "";
            }
	}
	
}; 

/*QWERTY 
1 - E 
2 - R 
3 - T 
4 - D 
5 - F 
6 - G 
7 - X 
8 - C 
9 - V 
0 - @ 
* - Z 
# - B 
+ - W 
p - P*/
Utils.isQWERTYDTMFKey = function(c) {
	var dtmfKey = "";

	switch (c){
		case 'e':
		case 'E':
			dtmfKey = '1';
			break;
		case 'r':
		case 'R':
			dtmfKey = '2';
			break;
		case 't':
		case 'T':
			dtmfKey = '3';
			break;
		case 'd':
		case 'D':
			dtmfKey = '4';
			break;
		case 'f':
		case 'F':
			dtmfKey = '5';
			break;			
		case 'g':
		case 'G':
			dtmfKey = '6';
			break;			
		case 'x':
		case 'X':
			dtmfKey = '7';
			break;			
		case 'c':
		case 'C':
			dtmfKey = '8';
			break;			
		case 'v':
		case 'V':
			dtmfKey = '9';
			break;
		case '@':
			dtmfKey = '0';
			break;
		case 'z':
		case 'Z':
			dtmfKey = '*';
			break;
		case 'b':
		case 'B':
			dtmfKey = '#';
			break;
		case 'w': 
		case 'W':
			dtmfKey = '+';
			break;
		case 'p': 
		case 'P':
			dtmfKey = c;
			break;			
		default:
			dtmfKey = "";
			break;
	}		
		
	if (((c >= '0' && c <= '9') || c == '*' || c == '#' || c == '+') ) {
		dtmfKey = c;
	} 
	
	return dtmfKey;
};


/*AZERTY 
1 - E 
2 - R 
3 - T 
4 - D 
5 - F 
6 - G 
7 - X 
8 - C 
9 - V 
0 - @ 
* - W 
# - B 
+ - P */
Utils.isAZERTYDTMFKey = function(c) {

	var dtmfKey = "";

	switch (c){
		case 'e':
		case 'E':
			dtmfKey = '1';
			break;
		case 'r':
		case 'R':
			dtmfKey = '2';
			break;
		case 't':
		case 'T':
			dtmfKey = '3';
			break;
		case 'd':
		case 'D':
			dtmfKey = '4';
			break;
		case 'f':
		case 'F':
			dtmfKey = '5';
			break;			
		case 'g':
		case 'G':
			dtmfKey = '6';
			break;			
		case 'x':
		case 'X':
			dtmfKey = '7';
			break;			
		case 'c':
		case 'C':
			dtmfKey = '8';
			break;			
		case 'v':
		case 'V':
			dtmfKey = '9';
			break;
		case '@':
			dtmfKey = '0';
			break;
		case 'b':
		case 'B':
			dtmfKey = '#';
			break;
		case 'w': 
		case 'W':
			dtmfKey = '*';
			break;
		case 'z': 
		case 'Z':
			dtmfKey = '+';
			break;	
		case 'p': 
		case 'P':
			dtmfKey = c;
			break;
		default:
			dtmfKey = "";
			break;
	}		
		
	if (((c >= '0' && c <= '9') || c == '*' || c == '#' || c == '+') ) {
		dtmfKey = c;
	} 
	
	return dtmfKey;
};


Utils.isAZERTYACCDTMFKey = function(c) {

	var dtmfKey = "";

	switch (c){
		case 'e':
		case 'E':
			dtmfKey = '1';
			break;
		case 'r':
		case 'R':
			dtmfKey = '2';
			break;
		case 't':
		case 'T':
			dtmfKey = '3';
			break;
		case 'd':
		case 'D':
			dtmfKey = '4';
			break;
		case 'f':
		case 'F':
			dtmfKey = '5';
			break;			
		case 'g':
		case 'G':
			dtmfKey = '6';
			break;			
		case 'x':
		case 'X':
			dtmfKey = '7';
			break;			
		case 'c':
		case 'C':
			dtmfKey = '8';
			break;			
		case 'v':
		case 'V':
			dtmfKey = '9';
			break;
		case '@':
			dtmfKey = '0';
			break;
		case 'b':
		case 'B':
			dtmfKey = '#';
			break;
		case 'w': 
		case 'W':
			dtmfKey = "*";
			break;
		case 'p': 
		case 'P':
			dtmfKey = "+";
			break;			
		default:
			dtmfKey = "";
			break;
	}		
		
	if (((c >= '0' && c <= '9') || c == '*' || c == '#' || c == '+') ) {
		dtmfKey = c;
	} 
	
	return dtmfKey;
};


/*QWERTZ 
1 - E 
2 - R 
3 - T 
4 - D 
5 - F 
6 - G 
7 - X 
8 - C 
9 - V 
0 - @ 
* - Y 
# - B 
+ - W 
p - P*/
Utils.isQWERTZDTMFKey = function(c) {

	var dtmfKey = "";

	switch (c){
		case 'e':
		case 'E':
			dtmfKey = '1';
			break;
		case 'r':
		case 'R':
			dtmfKey = '2';
			break;
		case 't':
		case 'T':
			dtmfKey = '3';
			break;
		case 'd':
		case 'D':
			dtmfKey = '4';
			break;
		case 'f':
		case 'F':
			dtmfKey = '5';
			break;			
		case 'g':
		case 'G':
			dtmfKey = '6';
			break;			
		case 'x':
		case 'X':
			dtmfKey = '7';
			break;			
		case 'c':
		case 'C':
			dtmfKey = '8';
			break;			
		case 'v':
		case 'V':
			dtmfKey = '9';
			break;
		case '@':
			dtmfKey = '0';
			break;
		case 'y':
		case 'Y':
			dtmfKey = '*';
			break;
		case 'b':
		case 'B':
			dtmfKey = '#';
			break;
		case 'w': 
		case 'W':
			dtmfKey = "+";
			break;
		case 'p': 
		case 'P':
			dtmfKey = c;
			break;			
		default:
			dtmfKey = "";
			break;
	}		
		
	if (((c >= '0' && c <= '9') || c == '*' || c == '#' || c == '+') ) {
		dtmfKey = c;
	} 
	
	return dtmfKey;
};

Utils.getDurationString = function(msec) {
	return Utils.getSeparatedDurationString((msec / 1000), true);
};

Utils.getSeparatedDurationString = function(sec, bLongFormat) {
	var hours = Math.floor(sec / 3600);
	sec = sec - (hours * 3600);
	var minutes = Math.floor(sec / 60); 
	sec = sec - (minutes * 60);
	var seconds = Math.round(sec);
	if (bLongFormat === true) {
		return Utils._durationLongFormatter.format({'hours': hours, 'minutes': minutes, 'seconds': seconds});
	} else {
		return Utils._durationShortFormatter.format({'hours': hours, 'minutes': minutes, 'seconds': seconds});
	}
},

// returns the location of the phone number, empty string otherwise
Utils.locationForAddress = function(address, transport) {	
	if (transport == enyo.application.CallSynergizer.TRANSPORTS.TIL) {		
		var mcc = enyo.application.TelephonyStatusInterface.mcc;
		var phone = new enyo.g11n.PhoneNumber(address, {mcc: mcc});
		var geoLoc = new enyo.g11n.GeoLocator({mcc: mcc});
		var geo = geoLoc.locate(phone);
		if ( geo ) {
			area = geo.area && geo.area.sn;
			country = (geo.country && geo.country.code != enyo.g11n.PhoneUtils.mapMCCtoRegion(mcc)) ? geo.country.sn : undefined;
			if ( area && country ) {
				return Utils.interpolate($L("#{area}, #{country}"), {area: area, country: country});
			} else {
				return area || country || "";
			}
		}
	}
	return "";
};

// this needs to be a part of the framework
Utils.interpolate = function(template, substitutions) {
	return (new enyo.g11n.Template(template)).evaluate(substitutions);
};

// this needs to be a part of the framework
Utils.formatChoice = function(template, value, substitutions) {
	return (new enyo.g11n.Template(template)).formatChoice(value, substitutions);
};

// copied from Contacts library: localized label and short label
Utils.contactPointLabels = {
	"type_mobile": [$L("Mobile"), $L("M")],
	"type_home": [$L("Home"), $L("H")],
	"type_home2": [$L("Home 2"), $L("H2")],
	"type_work": [$L("Work"), $L("W")],
	"type_work2": [$L("Work 2"), $L("W2")],
	"type_main": [$L("Main"), $L("M")],
	"type_personal_fax": [$L("Fax"), $L("F")],
	"type_work_fax": [$L("Fax"), $L("F")],
	"type_pager": [$L("Pager"), $L("P")],
	"type_personal": [$L("Personal"), $L("Pe")],
	"type_sim": [$L("SIM"),  $L("S")],
	"type_assistant": [$L("Assistant"), $L("A")],
	"type_car": [$L("Car"), $L("Ca")],
	"type_radio": [$L("Radio"), $L("R")],
	"type_company": [$L("Company"), $L("C")],
	"type_other": [$L("Other"), $L("O")],
	"type_skype": [$L("Skype"), $L("S")]
};

// Display names for IM contact-point types that plain Title-casing CANNOT produce - acronyms,
// internal capitals, punctuation, or a name that differs from the type altogether. Every other
// service (type_teams -> "Teams", type_discord -> "Discord", ...) is derived by imServiceLabel and
// needs NO entry here. This lives in Utils, not shared/addressing/labels.js, because the root window
// loads source/utils/all but not shared/addressing (see depends.js) - labels.js delegates here.
Utils.imServiceLabels = {
	"type_aim": $L("AIM"),
	"type_yahoo": $L("Yahoo!"),
	"type_gtalk": $L("GTalk"),
	"type_msn": $L("Messenger"),
	"type_icq": $L("ICQ"),
	"type_irc": $L("IRC"),
	"type_qq": $L("QQ"),
	"type_whatsapp": $L("WhatsApp"),
	"type_yjp": $L("Y! Japan"),
	"type_lcs": $L("LCS"),
	"type_dotmac": $L(".Mac"),
	"type_myspace": $L("MySpace"),
	"type_gadugadu": $L("GaduGadu"),
	"type_default": $L("IM")
};

// Display label for an IM contact-point type ("type_teams" -> "Teams"). SERVICE-AGNOSTIC: anything
// not needing special casing is derived from the type's own name, so a new connector needs no code.
Utils.imServiceLabel = function(type) {
	if (!type || String(type).indexOf("type_") !== 0) { return ""; }
	if (Utils.imServiceLabels[type]) { return Utils.imServiceLabels[type]; }
	var seg = String(type).slice("type_".length);
	return seg.charAt(0).toUpperCase() + seg.slice(1);
};

// Display name for a PHONE-transport call ("service" == the account templateId used at dial time).
// SERVICE-AGNOSTIC: do NOT hardcode each network. Prefer the registered PHONE account's own network
// name, then its serviceName ("type_whatsapp" -> "WhatsApp"), else derive from the templateId's last
// segment (com.palm.telegram -> "Telegram"). Adding a new IM calling service needs NO change here.
Utils.callNetworkName = function(service) {
	// service == the account templateId of the PHONE transport used for the call.
	if (!service) { return ""; }
	if (service === enyo.application.CallSynergizer.TRANSPORTS.TIL || service === "com.palm.telephony") {
		return $L("Cellular");
	}
	var t = enyo.application.CallSynergizer.transports && enyo.application.CallSynergizer.transports[service];
	if (t && t.networkName) { return t.networkName; }
	if (t && t.serviceName) { return Utils.imServiceLabel(t.serviceName); }
	var seg = String(service).split(".").pop();
	return seg ? Utils.imServiceLabel("type_" + seg) : service;
};

// returns list of emergency numbers from the til, or if none provided, from a default list
// guaranteed to return at least one element
Utils.getEmergencyNumbers = function() {
	var tilTransport = enyo.application.CallSynergizer.transports[enyo.application.CallSynergizer.TRANSPORTS.TIL];
	if ( tilTransport && tilTransport.emergencyNumbers && tilTransport.emergencyNumbers.length > 0 ) {
		return tilTransport.emergencyNumbers;
	} else {
		return ["911", "112", "000", "08", "110", "999", "118", "119", "#911", "*911"]
	}
};

// helper returns true if address is an emergency number
Utils.isEmergencyNumber = function(address) {
	return Utils.getEmergencyNumbers().indexOf(address) >= 0;
}; 

Utils.isOtaspNumber = function(number){
	var otasp = enyo.application.OTASPInterface.getOtaspNumber();
	return otasp && number && number.indexOf(otasp) == 0;
};

Utils.isVoicemailNumber = function(number) {
	var vmNum = enyo.application.VoicemailService.getVoicemailNumber();
	if (vmNum == undefined || vmNum == null || vmNum == "")
		return false;

	return number && number.indexOf(vmNum) === 0;
};

Utils.isInternationalCDMA = function() {
	if(enyo.application.Cache.platformType == "cdma" && enyo.application.TelephonyStatusInterface.mcc && enyo.application.Cache.homeMCC) {
		return (enyo.application.TelephonyStatusInterface.mcc != enyo.application.Cache.homeMCC) ? true: false;
	}
	
	return false;
};

Utils.formatRelativeDate = function(inDate) {
	return Utils._dateFormatter.formatRelativeDate(inDate);
};

Utils.formatShortTime = function(date) {
	return Utils._timeFormatter.format(date);
}

Utils.formatShortDate = function(date) {
	return Utils._dateFormatter.format(date);
}

Utils.formatDateTime = function(date) {
	return Utils._dateTimeFormatter.format(date);
}

Utils.getElaspedTime = function(startTime){
	var currentTime = new Date().getTime();   
	var elapsed = currentTime - startTime;  
	if (elapsed < 0) {
		elapsed = 0;
	}
	var timer = new Date(elapsed);
	return Utils._durationShortFormatter.format({'hours': timer.getUTCHours(), 'minutes': timer.getUTCMinutes(), 'seconds': timer.getUTCSeconds()});
};

// returns true if transport and address can be called
Utils.canBeCalled = function(transport, address) {
	enyo.require(transport, "no service passed to CallSynergyContact.canBeCalled");
	enyo.require(address != undefined, "CallSynergyContact.canBeCalled requires an address");

	// Cellular needs a dialable number; any enabled PHONE-capable VoIP transport
	// (whatsapp/telegram/signal/...) can be called - matched by templateId or its serviceName (type_*).
	if ( transport == enyo.application.CallSynergizer.TRANSPORTS.TIL ) {
		return !!address.match(/\d/);
	}
	var t = enyo.application.CallSynergizer.transports || {};
	if ( t[transport] ) { return true; }
	for ( var tid in t ) {
		if ( t[tid] && t[tid].serviceName === transport ) { return true; }
	}
	return false;
};

// returns true if transport and address can be messaged
Utils.canBeMessaged = function(transport, address) {
	enyo.require(transport, "no service passed to CallSynergyContact.canBeMessaged");
	enyo.require(address != undefined, "CallSynergyContact.canBeMessaged requires an address");
	
	// CASE: can always message skype
	if ( transport == enyo.application.CallSynergizer.TRANSPORTS.VOIP ) {
		return true;
	}
	
	// CASE: can message TIL if not emergency or otasp
	if ( transport == enyo.application.CallSynergizer.TRANSPORTS.TIL ) {
		return ! enyo.application.Utils.isEmergencyNumber(address) && ! enyo.application.Utils.isOtaspNumber(address);
	}
	
	// DEFAULT: all other services - sure?
	return true;
};

// normalizes an address by whitelisting characters
Utils.normalizePhNumber = function(address) {
	return address && String(address).replace(/[^\+01234567890\*#pwt]/g,'');
};


Utils.launchURI = function(uri) {
	var uriNoPrefix = uri.replace(/^((tel:)|(wtai:)|(skypevm:\/\/))/,''),
		params;
	
	// if prefix existed, pass rest as a phone number or message id
	if ( uriNoPrefix != uri ) {
		if (uri.indexOf("skypevm") != -1) {
			// TODO: Handle "skypevm" properly....
			/*new Mojo.Service.Request(TelephonyCommands.skypeSvcUri, {
				method: 'listenToVoicemail',
				parameters: {
					target: uriNoPrefix
				}
			});*/
			return;
		} else {
			params = {
				"fill": Utils.normalizePhNumber(unescape(uriNoPrefix))
			};
			enyo.application.UI.event('dial', params);
		}
	} else {
		enyo.log("Invalid launch target. It does not start with \"tel:, wtai:, or skypevm\": " + uri);
	}
};

Utils.kAreaCodesToTreatAsInternational = [
	684, // American Samoa 
	264, // Anguilla
	268, // Antigua
	242, // Bahamas
	246, // Barbados
	268, // Barbuda
	441, // Bermuda
	403,587, 780, 587, 250, 778, 604, 778, 204, 506, // Canada
	709, 867, 902, 416, 647, 519, 226, 613, 705, 807, // Canada
	905, 289, 418, 581, 450, 514, 438, 819, 306, 343, 579, // Canada
	345, // Cayman Islands
	767, // Dominica
	809, 829, 849, // Dominican Republic
	473, // Grenada
	671, // Guam
	876, // Jamaica
	664, // Montserrat
	670, // Northern Mariana Islands, East Timor
	787, 939, // Puerto Rico
	869, // St. Kitts and Nevis
	758, // St. Lucia
	784, // St. Vincent and the Grenadines
	868, // Trinidad and Tobago
	649, // Turks and Caicos Islands
	284, // Virgin Islands, British
	340, // Virgin Islands, U.S.
];

Utils.isValidNumber = function(number) {
	// strip format characters that may have slipped in
	number = number.replace(/[\(\)-\s]/g, "");
	// a valid number is one that starts with 0-9*#+ and is followed by one or more of 0-9*#+pw
	return /^[\d\*#+][\d\*#+pwt]*$/.test(number);
	
};

Utils.isInternationalNumber = function(number) { 
	var mcc = enyo.application.TelephonyStatusInterface.mcc; 
	var ph = new enyo.g11n.PhoneNumber(number); 
	var location = Utils._geoLocator.country(ph);

	var mccCountryCode = enyo.g11n.PhoneUtils.mapMCCtoRegion(mcc);
    var bIsIntl = (location !== mccCountryCode);

	// In North America we need to handle some special area codes as int'l numbers, therefore a call to _treatAsInternationalNumber is neccessary.
	if (bIsIntl === false && (mccCountryCode === "us" || mccCountryCode === undefined)) { // mccCountryCode === undefined to support the emulator
		return Utils._treatAsInternationalNumber(number);
	} else {
		return bIsIntl;
	}
}

Utils.isDomesticNumber = function(number) { 
	var mcc = enyo.application.TelephonyStatusInterface.mcc;
	var ph = new enyo.g11n.PhoneNumber(number);
	//enyo.log("mcc  =" + JSON.stringify(mcc) + "ph = " + JSON.stringify(ph));
	
	var location = Utils._geoLocator.country(ph);
	var mccCountryCode = enyo.g11n.PhoneUtils.mapMCCtoRegion(mcc);	
	//enyo.log("mccCountryCode  =" + JSON.stringify(mccCountryCode) + "location = " + JSON.stringify(location.country));
	
    	var bIsLocal = (location === mccCountryCode);
    	enyo.log("isDomesticNumber =" + bIsLocal);
    	return bIsLocal;
}

Utils._treatAsInternationalNumber = function(number) {
	var isInternational;

	// helper function returns true if area code is international
	isInternational = enyo.bind(this, function(areacode) {
		areacode = parseInt(areacode,10);
		return Utils.kAreaCodesToTreatAsInternational.indexOf(areacode) >= 0;
	});

	// always normalize
	number = enyo.application.Utils.normalizePhNumber(number);

	// clear everything after the first instance of p, w, or t
	number = number.replace(/[pwt].*$/,"");

	// contains a '*' or '#'
	if ( /[\*#]/.test(number) ) {
		return false;
	}

	// digits < 10: local number
	if ( number.length < 10 ) {
		return false;
	}

	// digits = 10: local, unless digits 0-2 match an area code in this document
	if ( number.length === 10 ) {
		return isInternational(number.substring(0,3));
	}

	// digits = 11: local, unless digit 0 is a 1 and digits 1-3 match an area code
	if ( number.length === 11 ) {
		return number.substring(0,1) == "1" && isInternational(number.substring(1,4));
	}

	// digits = 12: international, unless digits 0 & 1 are +1, and digits 2-4 don't match an area code
	if ( number.length === 12 ) {
		return number.substring(0,2) != "+1" || isInternational(number.substring(2,5));
	}

	// digits > 12: international
	return true;		
};

Utils.numberToWord = function(number){
	return [$L('Zero'),$L('One'),$L('Two'), $L('Three'),$L('Four'),$L('Five'),$L('Six'),$L('Seven'),$L('Eight'),$L('Nine')][number];
};

Utils.mapSpeedDialKey = function(c) {
	var keyBoardType = Utils.getKeyBoardType();
	var key = c;
	switch (c){
	case '2':
		key = 'r';
		break;
	case '3':
		key = 't';
		break;
	case '4':
		key = 'd';
		break;
	case '5':
		key = 'f';
		break;
	case '6':
		key = 'g';
		break;			
	case '7':
		key = 'x';
		break;			
	case '8':
		key = 'c';
		break;			
	case '9':
		key = 'v';
		break;
	}

	return key;
};

Utils.findInArray = function(arr, obj) {
	for(var i = 0; i < arr.length; i++) {
		if (arr[i] == obj) return true;
	}
	return false;
};

enyo.addressing.fetchLabelFromType = function(inContactType, inAddressType) {
	// IM labels are service-agnostic and owned by Utils.imServiceLabel, so that a new connector
	// (Teams, Discord, ...) is named correctly with no per-service entry anywhere.
	if (inContactType === "ims") {
		return enyo.application.Utils.imServiceLabel(inAddressType) ||
			enyo.application.Utils.imServiceLabel("type_default");
	}

	var labels = enyo.addressing.labels[inContactType];
	var label = labels && labels[inAddressType];
	return label && label.displayValue;
}

// Directory of address labels needed for addressing
enyo.addressing.labels = {
	emails: {
		type_home: {displayValue: $L('Home')},
		type_work: {displayValue: $L('Work')},
		type_other: {displayValue: $L('Other')}
	},
	//
	phoneNumbers: {
		type_mobile: {
			displayValue: $L('Mobile'),
			shortDisplayValue: $L('M')
		},
		type_home: {
			displayValue: $L('Home'),
			shortDisplayValue: $L('H')
		},
		type_home2: {
			displayValue: $L('Home 2'),
			shortDisplayValue: $L('H2')
		},
		type_work: {
			displayValue: $L('Work'),
			shortDisplayValue: $L('W')
		},
		type_work2: {
			displayValue: $L('Work 2'),
			shortDisplayValue: $L('W2')
		},
		type_main: {
			displayValue: $L('Main'),
			shortDisplayValue: $L('Ma')
		},
		type_personal_fax: {
			displayValue: $L('Fax'),
			shortDisplayValue: $L('P')
		},
		type_work_fax: {
			displayValue: $L('Fax'),
			shortDisplayValue: $L('F')
		},
		type_pager: {
			displayValue: $L('Pager'),
			shortDisplayValue: $L('P')
		},
		type_personal: {
			displayValue: $L('Personal'),
			shortDisplayValue: $L('Pe')
		},
		type_sim: {
			displayValue: $L('SIM'),
			shortDisplayValue: $L('S')
		},
		type_assistant: {
			displayValue: $L('Assistant'),
			shortDisplayValue: $L('A')
		},
		type_car: {
			displayValue: $L('Car'),
			shortDisplayValue: $L('Ca')
		},
		type_radio: {
			displayValue: $L('Radio'),
			shortDisplayValue: $L('R')
		},
		type_company: {
			displayValue: $L('Company'),
			shortDisplayValue: $L('C')
		},
		type_other: {
			displayValue: $L('Other'),
			shortDisplayValue: $L('O')
		}
	}
}

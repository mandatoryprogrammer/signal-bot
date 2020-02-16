const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const CDP = require('chrome-remote-interface');

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/*
	This establishes a DevTools remote debugging session with the Electron app.

	Once this is established successfully, the main() function will be called.

	Note you must have already run the Signal desktop app with the appropriate
	flag set before running this script, for example:
	./Signal --remote-debugging-port=9222
*/
CDP(async(client) => {
		main(client);
}).on('error', (err) => {
		console.error('Fatal error while trying to hook into Signal desktop:')
		console.error(err);
});

/*
 	This sends a message to another Signal user.

 	Parameters:

 	@client: This is the Chrome CDP client session (passed to main as `client`).
 	@to_number: This is the number of the signal user you want to send the message to.
 							Note: This MUST be formatted in the E.164 format, e.g: +11234567890
 	@message_body: The textual body of the message. e.g: "Hi"
 	@delete_ttl: An integer number of second(s) for the message to exist until it is
 							 automatically deleted. Note that you don't have to use one of the
 							 in-app numbers (e.g. 1 minute, 1 day). You can use any arbitrary
 							 number of seconds which the app will object (although the GUI may
 							 round it off, however it will still be respected accurately).
 */
async function send_message(client, to_number, message_body, delete_ttl) {
		const {
				Runtime
		} = client;

		console.log(`Sending message '${message_body.trim()}' to '${to_number}'...`);

		// Get payload off filesystem
		const payload_template = await readFile('injectables/send-message.js');
		var payload = payload_template.toString();

		// String replace our injected JavaScript to include
		// the appropriate parameters for our message send.
		payload = payload.replace(
			'{{RECEIVER_PHONE_NUMBER}}',
			JSON.stringify(to_number)
		);
		payload = payload.replace(
			'{{MESSAGE_BODY}}',
			JSON.stringify(message_body)
		);
		payload = payload.replace(
			'{{DELETE_TTL}}',
			JSON.stringify(delete_ttl)
		);

		//payload = `window.location.toString()`;

		return Runtime.evaluate({
				expression: payload,
				awaitPromise: true,
				returnByValue: true
		});
}

async function sanity_check(client) {
	const { Runtime } = client;
	const result = await Runtime.evaluate({
		expression: 'window.location.toString()',
		awaitPromise: true,
		returnByValue: true
	});
	console.log(result);
}

/*
	This is where the main bot logic lives, customize it at will.
*/
async function main(client) {
		// This is an example of sending a message to someone
		// using the Signal app.
		await send_message(
			client, // The Chrome debugging session client
			"+REPLACE_ME_WITH_TO_NUMBER", // The Signal user's phone number you want to message (must be in E.164 format)
			"Your custom message here.", // Body of the message you want to send
			( 60 * 60 * 24 ) // The number of seconds before the message should be deleted (Disappearing Message time)
		);

		// This hooks incoming Signal messages and
		// calls the callback with the contents and
		// metadata of the messages.
		await hook_incoming_messages(
			client,
			message_received
		);
}

/*
	This function is called when a message is
	received in the Signal desktop app.

	Fields you'll probably want:

	message.timestamp: Timestamp of message in microseconds (e.g: 1581845656358)
	message.id: Unique UUID for the message
	message.source: Phone number of the user who sent the message (e.g.: +12345678910)
	message.expireTimer: Number of seconds the message should be kept for before being
											 deleted (e.g. the Disappearing Messages time).
	message.body: The body of the message (e.g: Hello!)
	message.sent_at: Timestamp of when the message was sent in microseconds 
	 								 (e.g: 1581845656358)
	message.received_at: Timestamp of when the message was received in microseconds 
	 								 (e.g: 1581845656358)
*/
async function message_received(client, message) {
	// Write some code here to do something with the message.
	console.log(`Message from '${message.source}' (expiration ${message.expireTimer} second(s)) received: ${message.body}`);
}

async function hook_incoming_messages(client, callback) {
		const { Debugger } = client;

		console.log('Setting debugging breakpoint to hook inbound Signal messages...');
		const breakpoint_response = await Debugger.setBreakpointByUrl({
			// TODO: This is brittle, need to write a function to find the lineNo
			// and automatically fill it in so it can be somewhat stable in between
			// Signal versions.
			lineNumber: 2220,
			urlRegex: 'file:\/\/\/[a-zA-Z\.\/]+conversations\.js$'
		});

		Debugger.paused(async (params) => {
			// This is just the first call frame on the debugger stack
			const callFrameTargetId = params.callFrames[0].callFrameId;
      const evalResult = await Debugger.evaluateOnCallFrame({
          "callFrameId": callFrameTargetId,
          "expression": "messageJSON",
          "generatePreview": true,
          "includeCommandLineAPI": true,
          "throwOnSideEffect": true,
          "timeout": 500
      });
      const results = await convertAllChromeSerializedIntoVars(
      	client,
      	[evalResult.result]
      );
      const result = results[0];

      try {
      	await callback(
      		client,
      		result
      	);
      } catch ( e ) {
      	Debugger.resume();
      	throw e;
      	return
      }

			Debugger.resume();
		});
		await	Debugger.enable();
}

// These are from a separate personal project, but this is for recursively
// pulling/deserializing objects and other variables via the Chrome Devtool
// protocol. This is such a PITA to do, but anyways this will give you a sane
// data structure back (takes an array, if you need a single item just set
// inputItems to be an array with one item, e.g: [inputItem]).
async function convertAllChromeSerializedIntoVars(client, inputItems) {
    const max_depth = 3;
    return Promise.all(inputItems.map(inputItem => {
        return _convertChromeSerializedIntoVars(
            client,
            inputItem,
            max_depth
        );
    }));
}

function isUnserializableItem(inputItem) {
    const valid_types = [
        'object',
        'array',
        'string',
        'function',
        'undefined',
        'number',
        'boolean'
    ];

    // Is it an object?
    if(!(typeof(inputItem) === 'object') ) {
        return false;
    }

    // Is it null (null is an object)?
    if(inputItem === null) {
        return false;
    }

    // Does it have .type? Is the .type a valid value?
    if(!( 'type' in inputItem) || !valid_types.includes(inputItem.type) ) {
        return false;
    }

    return true;
}

async function _convertChromeSerializedIntoVars(client, inputItem, remaining_depth) {
    // Quit out if we're too deep
    if(remaining_depth <= 0) {
        return inputItem;
    }
    remaining_depth--;

    // If the item we've been passed is not unserializable
    // we just return it in it's immediate format.
    if(!isUnserializableItem(inputItem)) {
        return inputItem;
    }

    const deserializedItem = await convertChromeSerializedIntoVars(
        client,
        inputItem,
        remaining_depth
    );

    // Check if the immediately deserializedItem is yet another item
    // that needs to be deserialized.
    if(isUnserializableItem(deserializedItem)) {
        return _convertChromeSerializedIntoVars(
            client,
            inputItem
        );
    }

    // Check if there's still some serialized shit in it. If so, we'll
    // have to recurse further to resolve those
    if(typeof(deserializedItem) === 'object' && deserializedItem !== null) {
        var newObject = {};
        const objectKeys = Object.keys(deserializedItem);
        await Promise.all(objectKeys.map(async objectKey => {
            newObject[objectKey] = await _convertChromeSerializedIntoVars(
                client,
                deserializedItem[objectKey],
                remaining_depth
            );
        }));
        return newObject;
    }

    return deserializedItem;
}

async function convertChromeSerializedIntoVars(client, inputItem) {
    // JavaScript is war against developers
    if( inputItem.type === 'object' && inputItem.subtype === 'null' ) {
        return null;
    } else if(inputItem.type === 'object') {
        return getObject(client, inputItem.objectId );
    } else if ( inputItem.type === 'array') {
        return getArray( client, inputItem.objectId );
    } else if ( inputItem.type === 'string' ) {
        return inputItem.value;
    } else if( inputItem.type === 'function' ) {
        return inputItem.description;
    } else if ( inputItem.type === 'undefined' ) {
        return undefined;
    } else if ( inputItem.type === 'number' ) {
        return inputItem.value;
    } else if ( inputItem.type === 'boolean' ) {
        return inputItem.value;
    }

    return inputItem;
}

async function getArray(client, objectId) {
    const evalObject = await client.Runtime.getProperties({
        objectId: objectId
    });

    const objectNumericKeys = evalObject.result.filter(objectItem => {
        return !isNaN(objectItem.name);
    });

    return objectNumericKeys.map(objectItem => {
        return objectItem.value;
    });
}

async function getObject(client, objectId) {
    const objectValues = await client.Runtime.getProperties({
        objectId: objectId
    });

    var return_object = {};

    objectValues.result.map(objectValue => {
        return_object[ objectValue.name ] = objectValue.value;
    });

    return return_object;
}
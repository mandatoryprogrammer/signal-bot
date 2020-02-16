# Signal Messenger Bot by [@IAmMandatory](https://twitter.com/IAmMandatory)
## _Signal Desktop Required, Not An Official Signal Client_

## What is it?

This is a Node script to automate the [Signal Desktop client](https://signal.org/download/). You can use it to write Signal bots for secure automated messaging (no more unsafe SMS!).

It's also meant to serve as a commented reference for how to hook and orchestrate Electron & web apps with the Chrome DevTools Protocol (see [`Why use the Chrome DevTools Protocol?`](#why-use-the-chrome-devtools-protocol) below).

## How do I use it?

* [Install the latest Node](https://nodejs.org/en/download/)
* Clone this repo `git clone https://github.com/mandatoryprogrammer/signal-bot`
* Install the dependencies `cd signal-bot; npm install`
* Start your Signal Desktop app with the `--remote-debugging-port` flag, like so:

```
# Note you must set it to port 9222, make sure you have no other debugging sessions
# set up so there's no conflictions.
$ ./Signal --remote-debugging-port=9222
```
* Modify `signal-hook.js` to do whatever you want.
* Run this script: `node signal-hook.js` and it will hook into Signal Desktop and automate it!

## Code Examples

Send a Signal message to another Signal user with a custom [Disappearing Message](https://support.signal.org/hc/en-us/articles/360007320771-Set-and-manage-disappearing-messages) time:

```javascript
async function main(client) {
	// This is an example of sending a message to someone
	// using the Signal app.
	await send_message(
		client, // The Chrome debugging session client
		"+12345678910", // The Signal user's phone number you want to message (must be in E.164 format)
		"Your custom message here.", // Body of the message you want to send
		( 60 * 60 * 24 ) // The number of seconds before the message should be deleted (Disappearing Message time)
	);
}
```

Process messages sent to you via Signal:

```javascript
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
```

## How does this work?

This is a Node script which utilizes [Chrome Remote Debugging](https://blog.chromium.org/2011/05/remote-debugging-with-chrome-developer.html)/the [DevTools protocol](https://chromedevtools.github.io/devtools-protocol/) to hook into the Signal Desktop app and automate its functionality. This is possible because the Signal Desktop client is an Electron app, so it supports the `--remote-debugging-port` flag. This allows us to use the Chrome DevTools protocol to hook into the app's functionality and inject JavaScript, set breakpoints, etc.

## Why use the Chrome DevTools Protocol?

This project is meant to be an example of how to hook and orchestrate an Electron app, web app, or similar using the Chrome DevTools Protocol. This is quite useful because it lets you hook and call existing functions in apps to get what you want done without having to reverse engineer protocols, APIs, and the rest of the nitty-gritty low level stuff. It is also much more scalable if you have an app that changes often to hook it at a high level. Even if the developers completely change the underlying protocols and specs, you can easily adapt by just calling the higher-level functions which already implement it.

In this case study of Signal Desktop for example, I didn't have to learn anything about the underlying cryptography or write a (likely insecure) client implementing it. Instead I just hook into the already-working Signal Desktop app and call its existing functions to send messages and hook inbound messages.

**Note**: The downside is that the Chrome DevTools Protocol is extremely grainy and complex. This code is meant to serve as an example of how to tame some of it. Sadly there's not a lot of good reference code for Chrome DevTools automation outside of [Puppeteer](https://github.com/puppeteer/puppeteer), which was another reason I wanted to open source this example.


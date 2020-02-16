# Signal Bot (Signal Desktop Required, Not An Official Signal Client)

## What is it?

This is a Node script to automate Signal Desktop. You can use it to write Signal bots for secure automated messaging (no more unsafe SMS!).

It's also meant to serve as a reference for how to hook and orchestrate Electron apps with the Chrome DevTools Protocol (see `Why use the Chrome DevTools Protocol?` below).

## How do I use it?

* [Install the latest Node](https://nodejs.org/en/download/)
* Clone this repo `git clone https://github.com/mandatoryprogrammer/signal-bot`
* Install dependencies `cd signal-bot; npm install`
* Start your Signal desktop app with the `--remote-debugging-port` flag, like so:
```
# Note you must set it to port 9222, make sure you have no other debugging sessions
# set up so there's no conflictions.
$ ./Signal --remote-debugging-port=9222
```
* Run this script and it will hook into Signal Desktop and automate it! `node signal-hook.js`
* Modify `signal-hook.js` to do whatever you want.

## How does this work?

This is a Node script which utilizes the Chrome Remote Debugging/[DevTools protocol](https://chromedevtools.github.io/devtools-protocol/) to hook into the Signal Desktop app and automate its functionality. This is possible because the Signal Desktop app is an Electron app, so it supports the `--remote-debugging-port` flag. This allows us to use the Chrome DevTools protocol to hook into the app's functionality and inject JavaScript, set breakpoints, etc.

## Why use the Chrome DevTools Protocol?

This project is meant to be an example of how to orchestrate an Electron app, web app, or similar using the Chrome DevTools Protocol. This is quite useful because it lets you hook and call existing functions in apps to get what you want done without having to reverse engineer protocols and do all the nitty-gritty low level stuff. It also is much more scalable if you have an app that changes often to hook it at a high level.

For this case study of Signal Desktop, I didn't have to learn anything about the underlying cryptography or write a likely insecure client implementing it. Instead I just hook into the already-working Signal Desktop app and call its existing functions to send messages and hook inbound messages.

Note: The downside is that the Chrome DevTools Protocol is extremely grainy and complex. This code is meant to serve as an example of how to tame some of it. Sadly there's not a lot of good reference code for Chrome DevTools automation, which was another reason I wanted to open source this example.


# discord-end2end-encryption

a friend wanted me to make it so here, discord end to end encryption

# installation 
- first you need `tampermonkey` extension on your browser
- after doing that goto `tampermonkey dashboard`, click on `+` to create a new script
- copy paste the code inside `discord-end2end-encryption.js`

# usage
- first you need to add `path of the channel` with your `passphrase` to here inside the code (im too lazy to make an ui for it)
```js
const keys = {
  '/channels/@me/**************': 'enter here some random passphrase'
}
```
- then you can just write your message and when you add `$$` at the end of it, then script will encrypt your message
- you need to press `space` before pressing enter and sending the message, because discord doesnt recognize the change until user input

#
it will automatically decrypt the messages

made the code as clean as possible, separated the dom element selections and manipulations so if the discord changes their class names etc its easy to fix

# known issues 
- link embeds won't work because discord is creating them on their side so since they cant see the context of the message, no link embeds

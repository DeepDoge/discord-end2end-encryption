# discord-end2end-encryption

a friend wanted me to make it so here, discord end to end encryption

# installation

- first you need `tampermonkey` extension on your browser
- after doing that goto `tampermonkey dashboard`, click on `+` to create a new script
- copy paste the code inside `discord-end2end-encryption.js`

# usage

- first you need to add `path of the channel` with your `passphrase` to here inside the code (im too lazy to make an ui for it)

```js
const keyStore = 
{
  "/channels/@me/*************":
    // you can have multiple passphrases for different prefixes, so if u change your passphrase you can still see the old messages
    [
      // first passphrase is the default one and will be used to encrypt your messages
      {
        // prefix for the encrypted message so the script can know which passphrase to use
        // all prefixes are put inside $$(your prefix): so you can use any prefix you want safely
        prefix: "2",
        passphrase: "new (current) passphrase here",
      },
      // old passphrase !!! you can remove this part if you dont have an old passphrases
      {
        prefix: "1",
        passphrase: "old passphrases here",
      },
      // ...
    ],
  "channels/************": 
  [
    {
      prefix: "🍕",
      passphrase: "",
    },
  ],
};
```

- then just send the message and the script should encrypt it

#

it will automatically decrypt the messages

made the code as clean as possible, separated the dom element selections and manipulations so if the discord changes their class names etc its easy to fix

# known issues

- `link embeds` won't work because discord is creating them on their side so since they cant see the context of the message, no link embeds
- its having trouble showing the `emojis`, right now. since discord is parsing them as `image` in the `textbox`
- `upload modal` encryption not working if you press `enter` but the `textbox` has no `focus` (btw clicking on `upload button` works)  

not working on it for a while

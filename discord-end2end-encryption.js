// ==UserScript==
// @name         discord-end2end-encryption
// @namespace    http://tampermonkey.net/
// @version      0.1
// @author       https://github.com/DeepDoge
// @include      https://discord.com/*
// @grant        none
// ==/UserScript==

(() =>
{
    const Main = async () =>
    {
        const domActions = (() =>
        {
            const getMessagesArray = () =>
            {
                return Array.from(document.querySelectorAll('[class*="chatContent-"] [class*="messagesWrapper-"] [class*="messageContent-"]')) // selecting messageContent to select also replies and maybe things that might come with some future updates
                    .map(el =>
                    ({
                        get element() { return el }, // where the text is

                        get text() // text itself
                        {
                            let child = this.element?.firstChild
                            const texts = []

                            while (child)
                            {
                                if (child.nodeType === 3) texts.push(child.data)
                                child = child.nextSibling
                            }

                            return texts.join("")
                        },
                        set text(value) { Array.from(this.element.childNodes).find((child) => child.nodeType === 3).nodeValue = value },

                        get prefixElement() { return this.element.querySelector('[__prefixEl]') }, // custom element right before the text
                        set prefixElement(prefixEl)
                        {
                            if (this.prefixElement) this.prefixElement.remove()
                            if (!prefixEl) return
                            prefixEl.setAttribute('__prefixEl', '')
                            this.element.insertBefore(prefixEl, this.element.firstChild)
                        }
                    }))
            }

            let messageBoxElement = null
            const messageBox = {
                beforeSendEventListener: null,
                get element() { return messageBoxElement },
                get text() // message input
                {
                    return Array.from(this.element.querySelectorAll('[class*="slateTextArea-"] [data-slate-string]'))
                        .map((line) => line.textContent).join('\n')

                },
                set text(value)
                {
                    const reactEditor = this.element.querySelector('[class*="slateTextArea-"]')
                        .__reactInternalInstance$.memoizedProps.children.props.editor
                    reactEditor.moveAnchorToEndOfDocument()
                    for (let i = 0; i < 2000; i++) reactEditor.deleteBackward()
                    reactEditor.insertText(value)
                }
            };
            // MessageBox function
            (async () =>
            {
                let pressedKeys = {}
                const resetPressedKeys = () => pressedKeys = {}

                const addListener = (element) =>
                {
                    element.addEventListener('keydown', onKeyDown)
                    element.addEventListener('keyup', onKeyUp)
                }

                const removeListener = (element) =>
                {
                    element.removeEventListener('keydown', onKeyDown)
                    element.removeEventListener('keyup', onKeyUp)
                }

                const onKeyDown = (event) =>
                {
                    pressedKeys[event.key] = true
                    if (pressedKeys['Enter'] && !pressedKeys['Shift']) 
                    {
                        resetPressedKeys()
                        eventFunc()
                    }
                }

                const onKeyUp = (event) =>
                {
                    delete pressedKeys[event.key]
                }

                window.addEventListener('blur', resetPressedKeys)
                document.addEventListener('visibilitychange', resetPressedKeys)

                const eventFunc = () =>
                {
                    if (messageBox.beforeSendEventListener) messageBox.beforeSendEventListener()
                }

                const getUploadModalMessageBox = () => document.querySelector('[class*="uploadModal-"]')
                const getEditMessageBox = () => document.querySelector('[class*="message-"] [class*="textArea-"]:focus-within')
                const getChatMessageBox = () => document.querySelector('form[class*="form-"]:focus-within')

                let _elementCache = null
                while (true)
                {
                    await new Promise((resolver, reject) => setTimeout(resolver, 500))

                    messageBoxElement = getUploadModalMessageBox() ?? getEditMessageBox() ?? getChatMessageBox()
                    if (_elementCache === messageBoxElement) continue
                    if (_elementCache) removeListener(_elementCache)
                    if (_elementCache === getUploadModalMessageBox())
                    {
                        messageBoxElement.querySelector('button[type="submit"]')?.removeEventListener('click', eventFunc)
                    }
                    _elementCache = messageBoxElement
                    if (!messageBoxElement) continue
                    addListener(messageBoxElement)

                    if (messageBox.beforeSendEventListener && messageBoxElement === getUploadModalMessageBox())
                    {
                        messageBoxElement.querySelector('button[type="submit"]').addEventListener('click', eventFunc)
                    }
                }
            })()

            return { getMessagesArray, messageBox }
        })()

        const crypto = (() =>
        {
            const AES = (() =>
            {
                const name = 'AES-GCM'

                const importKey = async (key) =>
                {
                    return await window.crypto.subtle.importKey('raw',
                        Uint8Array.from(atob(key), c => c.charCodeAt(0)),
                        name, true, ["encrypt", "decrypt"])
                }
                const generateKey = async () =>
                {
                    const importedKey = await window.crypto.subtle.generateKey({ name, length: 256 }, true, ['encrypt', 'decrypt'])
                    const buffer = await window.crypto.subtle.exportKey('raw', importedKey)
                    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
                }
                const encrypt = async (text, key) =>
                {
                    const iv = window.crypto.getRandomValues(new Uint8Array(12))
                    const algorithm = { iv, name }
                    const importedKey = await importKey(key)
                    const buffer = await window.crypto.subtle.encrypt(algorithm, importedKey, new TextEncoder().encode(text))
                    return `${btoa(String.fromCharCode(...iv))}-${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`
                }
                const decrypt = async (encrypted, key) =>
                {
                    encrypted = encrypted.split('-')
                    const iv = Uint8Array.from(atob(encrypted[0]), c => c.charCodeAt(0))
                    const algorithm = { iv, name }
                    const importedKey = await importKey(key)
                    const buffer = Uint8Array.from(atob(encrypted[1]), c => c.charCodeAt(0))
                    return new TextDecoder().decode(await window.crypto.subtle.decrypt(algorithm, importedKey, buffer))
                }
                return { encrypt, decrypt, generateKey }
            })()

            const RSA = (() =>
            {
                const name = "RSA-OAEP"
                const hash = { name: "SHA-256" }

                const importKey = async (key) =>
                {
                    const jwk = JSON.parse(atob(key))
                    return await window.crypto.subtle.importKey("jwk", jwk, { name, hash }, true, jwk.key_ops)
                }
                const generateKeys = async () =>
                {
                    const publicExponent = new Uint8Array([0x01, 0x00, 0x01])
                    const importedKeys = await window.crypto.subtle.generateKey({ name, hash, modulusLength: 1024, publicExponent }, true, ["encrypt", "decrypt"])

                    const publicKey = btoa(JSON.stringify(await window.crypto.subtle.exportKey('jwk', importedKeys.publicKey)))
                    const privateKey = btoa(JSON.stringify(await window.crypto.subtle.exportKey('jwk', importedKeys.privateKey)))
                    return { publicKey, privateKey }
                }
                const encrypt = async (text, publicKey) =>
                {
                    const importedKey = await importKey(publicKey)
                    const buffer = await window.crypto.subtle.encrypt({ name }, importedKey, new TextEncoder().encode(text))
                    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
                }
                const decrypt = async (encrypted, privateKey) =>
                {
                    const importedKey = await importKey(privateKey)
                    const buffer = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
                    return new TextDecoder().decode(await window.crypto.subtle.decrypt({ name }, importedKey, buffer))
                }

                return { generateKeys, encrypt, decrypt }
            })()

            return { AES, RSA }
        })()

        const localStorage = (() =>
        {
            function getLocalStoragePropertyDescriptor()
            {
                const iframe = document.createElement('iframe')
                document.head.append(iframe)
                const pd = Object.getOwnPropertyDescriptor(iframe.contentWindow, 'localStorage')
                iframe.remove()
                return pd
            }

            const localStorage = getLocalStoragePropertyDescriptor().get.call(window)

            return localStorage
        })()

        const generateChannelKey = async (channelId) =>
        {
            const key = {
                key: await crypto.AES.generateKey(),
                prefix: btoa(String.fromCharCode(...window.crypto.getRandomValues(new Uint8Array(8))))
            }

            const keys = getChannelKey(channelId)
            keys.unshift(key)
            localStorage.setItem(`__end2end-key-${channelId}`, keys)

            return key
        }
        const getChannelKey = (channelId) =>
        {
            return JSON.parse(localStorage.getItem(`__end2end-key-${channelId}`))
        }

        const myKeys = crypto.RSA.generateKey()

        const safePrefix = (prefix) => 
        {
            if (!prefix) 
            {
                Notify.push("prefix can't be empty")
                throw new Error("prefix can't be empty")
            }
            return `$$${prefix}:`
        }

        const encryptMessageBox = () =>
        {
            const keys = getChannelKey(location.pathname)
            if (!keys) return

            const text = domActions.messageBox.text
            if (!text) return

            const encrypted = crypto.AES.encrypt(text, keys[0].key).toString()
            console.log('encrypted', text, encrypted)

            domActions.messageBox.text = safePrefix(keys[0].prefix) + encrypted
        }
        domActions.messageBox.beforeSendEventListener = encryptMessageBox

        const decryptMessages = async () =>
        {
            const addPrefixElement = (message) =>
            {
                // add 'decrypted' chip before the message
                const prefixElement = document.createElement('span')
                prefixElement.style.marginRight = '2px'
                prefixElement.style.padding = '2px'
                prefixElement.style.borderRadius = '5px'
                prefixElement.style.background = '#7289DA'
                prefixElement.style.color = '#fff'
                prefixElement.style.fontFamily = 'arial'
                prefixElement.style.fontSize = '10px'
                prefixElement.style.fontWeight = 'bold'

                const img = document.createElement('img')
                img.src = 'https://discord.com/assets/8b7eb8b25468313916d2e5ec3727cd2d.svg'
                img.style.height = '10px'
                img.style.width = '10px'
                prefixElement.appendChild(img)

                message.prefixElement = prefixElement
            }

            const keys = getChannelKey(location.pathname)
            if (!keys) return

            const messages = domActions.getMessagesArray()
            for (const message of messages)
            {
                const rawText = message.text
                if (!rawText) continue // skip if the message is undefined like

                if (message.element.__textCache === rawText) continue // skip if its already been tried to decrypted, so it skips the errors
                if (message.prefixElement) message.prefixElement = null
                message.element.__textCache = rawText // btw also setting this after the decryption at the bottom

                const key = keys.find((key) => rawText.startsWith(safePrefix(key.prefix)))  // check if the message has the prefix
                if (!key) continue // skip if it doesnt fit with any prefix

                const encrypted = rawText.substr(safePrefix(key.prefix).length) // get text, remove the Prefix

                try
                {
                    // decrypted the message and update it
                    console.log('decrypting', encrypted)
                    const text = crypto.AES.decrypt(encrypted, key.passphrase) // decrypt the text
                    message.text = text // change the dom
                    addPrefixElement(message)
                    message.element.__textCache = text
                    console.log('decrypted', encrypted, text)
                }
                catch (ex)
                {
                    console.error('decryption failed', ex)
                }

                await new Promise((resolver, reject) => setTimeout(resolver, 10))
            }
        }

        while (true)
        {
            await decryptMessages()
            await new Promise((resolver, reject) => setTimeout(resolver, 100))
        }
    }

    const Notify = (() =>
    {
        const overlay = document.createElement('div')
        document.body.appendChild(overlay)
        overlay.style.pointerEvents = 'none'
        overlay.style.position = 'fixed'
        overlay.style.height = '100%'
        overlay.style.width = '100%'
        overlay.style.display = 'flex'
        overlay.style.flexDirection = 'column'
        overlay.style.alignItems = 'center'
        overlay.style.zIndex = '9999999'

        const push = (message, timeout = 5000) =>
        {
            if (!message) throw new Error('cant push empty message')

            const item = document.createElement('div')
            overlay.appendChild(item)
            item.style.minWidth = '300px'
            item.style.borderRadius = '10px'
            item.style.background = '#7289DA'
            item.style.color = '#fff'
            item.style.fontFamily = 'arial'
            item.style.fontSize = '16px'
            item.style.fontWeight = 'bold'
            item.style.padding = '20px'
            item.style.textAlign = 'center'

            item.textContent = message

            const remove = () => item.remove()

            if (timeout >= 0) setTimeout(remove, timeout)

            return { remove }
        }

        return { push }
    })()

    Main()
})()

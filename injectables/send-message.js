(async function() {
    var SEALED_SENDER = {
        UNKNOWN: 0,
        ENABLED: 1,
        DISABLED: 2,
        UNRESTRICTED: 3,
    };

    // Number we're sending the message to.
    var id = JSON.parse('{{RECEIVER_PHONE_NUMBER}}');

    // Pull our own number
    var ourNumber = textsecure.storage.user.getNumber();

    async function getSendOptions(options = {}) {
        const senderCertificate = storage.get('senderCertificate');
        const numberInfo = await getNumberInfo(options);

        return {
            senderCertificate,
            numberInfo,
        };
    };

    async function getNumberInfo(options = {}) {
        const {
            syncMessage,
            disableMeCheck
        } = options;

        if (!ourNumber) {
            return null;
        }

        // START: this code has an Expiration date of ~2018/11/21
        // We don't want to enable unidentified delivery for send unless it is
        //   also enabled for our own account.
        const me = ConversationController.getOrCreate(ourNumber, 'private');
        if (!disableMeCheck &&
            me.get('sealedSender') === SEALED_SENDER.DISABLED
        ) {
            return null;
        }
        // END

        // Get the access Key
        const c = await ConversationController.getOrCreateAndWait(id, 'private');
        await c.deriveAccessKeyIfNeeded();
        const numberInfo = c.getNumberInfo({
            disableMeCheck: true
        }) || {};
        const getInfo = numberInfo[c.id] || {};

        const accessKey = getInfo.accessKey;
        //const sealedSender = this.get('sealedSender');
        const sealedSender = 1;

        // We never send sync messages as sealed sender
        if (syncMessage && id === ourNumber) {
            return null;
        }

        // If we've never fetched user's profile, we default to what we have
        if (sealedSender === SEALED_SENDER.UNKNOWN) {
            return {
                [id]: {
                    accessKey: accessKey ||
                        window.Signal.Crypto.arrayBufferToBase64(
                            window.Signal.Crypto.getRandomBytes(16)
                        ),
                },
            };
        }

        if (sealedSender === SEALED_SENDER.DISABLED) {
            return null;
        }

        return {
            [id]: {
                accessKey: accessKey && sealedSender === SEALED_SENDER.ENABLED ?
                    accessKey :
                    window.Signal.Crypto.arrayBufferToBase64(
                        window.Signal.Crypto.getRandomBytes(16)
                    ),
            },
        };
    };

    const options = await getSendOptions();

    return textsecure.messaging.sendMessageToNumber(
        id,
        JSON.parse('{{MESSAGE_BODY}}'),
        [],
        null,
        [],
        undefined,
        null,
        Math.floor(Date.now()),
        JSON.parse('{{DELETE_TTL}}'),
        storage.get('profileKey'),
        options
    );
})();
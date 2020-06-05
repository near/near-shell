
const exitOnError = require('../utils/exit-on-error');
const connect = require('../utils/connect');
const { KeyPair } = require('near-api-js');
const eventtracking = require('../utils/eventtracking');

module.exports = {
    command: 'create_account <accountId>',
    desc: 'create a new developer account',
    builder: (yargs) => yargs
        .option('accountId', {
            desc: 'Unique identifier for the newly created account',
            type: 'string',
            required: true
        })
        .option('masterAccount', {
            desc: 'Account used to create requested account.',
            type: 'string',
            required: true
        })
        .option('publicKey', {
            desc: 'Public key to initialize the account with',
            type: 'string',
            required: false
        })
        .option('newLedgerKey', {
            desc: 'HD key path to use with Ledger. Used to generate public key if not specified directly',
            type: 'string',
            default: "44'/397'/0'/0'/1'"
        })
        .option('initialBalance', {
            desc: 'Number of tokens to transfer to newly created account',
            type: 'string',
            default: '100'
        }),
    handler: exitOnError(createAccount)
};

async function createAccount(options) {
    await eventtracking.track(eventtracking.EVENT_ID_CREATE_ACCOUNT_START, { nodeUrl: options.nodeUrl });
    // NOTE: initialBalance is passed as part of config here, parsed in middleware/initial-balance
    let near = await connect(options);
    let keyPair;
    let publicKey;
    if (options.publicKey) {
        publicKey = options.publicKey;
    } else {
        keyPair = await KeyPair.fromRandom('ed25519');
        publicKey = keyPair.getPublicKey();
    }
    if (keyPair) {
        await near.connection.signer.keyStore.setKey(options.networkId, options.accountId, keyPair);
    }
    try {
        await near.createAccount(options.accountId, publicKey);
    } catch(error) {
        if (error.message.includes('Timeout')) {
            console.warn('Received a timeout when creating account, please run:');
            console.warn(`near state ${options.accountId}`);
            console.warn('to confirm creation. Keyfile for this account has been saved.');
        } else {
            near.connection.signer.keyStore.removeKey(options.networkId, options.accountId)
                .then(() => {
                    throw error;
                }).catch((e) => console.error(e));
        }
    }
    console.log(`Account ${options.accountId} for network "${options.networkId}" was created.`);
    await eventtracking.track(eventtracking.EVENT_ID_CREATE_ACCOUNT_END, { node: options.nodeUrl, success: true });
}

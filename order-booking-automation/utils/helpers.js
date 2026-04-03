// Common wait / retry helpers
module.exports = {
    wait: async (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

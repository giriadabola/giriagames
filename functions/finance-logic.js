// As duas moedas são independentes. Os campos antigos identificam origens,
// não constituem uma taxa de câmbio implícita.
const CURRENCIES = ["gcoins", "mini-gcoins"];
const MINI_STATES = new Set(["WhoWins Paid", "Investimentos Paid", "Endless Paid"]);

function finite(value, label = "Valor") {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
        throw new Error(`${label} inválido.`);
    }
    return value;
}

function movementCurrency(movement) {
    if (movement.currency !== undefined) {
        if (!CURRENCIES.includes(movement.currency)) throw new Error("Moeda desconhecida no movimento.");
        return movement.currency;
    }
    return MINI_STATES.has(movement.estado) ? "mini-gcoins" : "gcoins";
}

function readWallet(user, season, currency) {
    const data = user?.[season] || {};
    if (!CURRENCIES.includes(currency)) throw new Error("Moeda inválida.");
    if (currency === "gcoins") return finite(data.GCoins ?? user?.[season.replace(/\D/g, "") + "GCoins"] ?? 0, "Saldo de gCoins");
    // Depois da primeira operação segura, apenas este campo representa saldo.
    return finite(data["mini-gcoins"] ?? ((data.whowinsgCoins ?? 0) + (data.investimentosgCoins ?? 0)), "Saldo de mini-gCoins");
}

function bankData(data, season) {
    const seasonal = data?.[season] ?? data?.[season.replace(/\D/g, "")];
    const fields = seasonal && typeof seasonal === "object" ? seasonal : {};
    return {...data, ...fields, valor: finite(fields.valor ?? (typeof seasonal === "number" ? seasonal : data?.valor) ?? 0, "Saldo da Banca")};
}

function calculateConversion(amount, rate, fee) {
    finite(amount); finite(rate); finite(fee);
    if (amount <= 0 || rate <= 0 || fee < 0 || fee > 1) throw new Error("Montante ou taxa de conversão inválidos.");
    const gross = amount / rate;
    const bank = gross * fee;
    const user = gross - bank;
    if (![gross, bank, user].every(value => Number.isSafeInteger(Math.round(value)) && Math.abs(value - Math.round(value)) < 1e-9)) {
        throw new Error("A conversão deve resultar em gCoins inteiros para o jogador e para a Banca.");
    }
    return {gross: Math.round(gross), bank: Math.round(bank), user: Math.round(user)};
}

module.exports = {CURRENCIES, finite, movementCurrency, readWallet, bankData, calculateConversion};

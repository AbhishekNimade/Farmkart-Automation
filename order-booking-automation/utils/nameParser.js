export function parseCustomerName(fullName) {
    if (!fullName) return { firstName: "Unknown", lastName: "." };

    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 1) {
        return {
            firstName: parts[0],
            lastName: "." // Delhivery often requires last name
        };
    } else if (parts.length === 2) {
        return {
            firstName: parts[0],
            lastName: parts[1]
        };
    } else {
        // "Pankaj Kumar Patidar" -> First: "Pankaj", Last: "Kumar Patidar"
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");
        return { firstName, lastName };
    }
}

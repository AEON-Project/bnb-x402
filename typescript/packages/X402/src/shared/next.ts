// import { NextRequest } from "next/server.js";

export const getHost = (request: any) => {
    return (request.headers.get('x-forwarded-host') || request.headers.get('host'))!
}

export const getScheme = (request: any) => {
    return (request.headers.get('x-scheme') === 'https' || request.nextUrl.port === '443') ? 'https' : 'http'
}

export const getUrl = (request: any) => {
    return `${getScheme(request)}://${getHost(request)}`
}

export const getFacilitator = () => {
    // Check if we're in a Node.js environment (server-side)
    if (typeof process !== 'undefined' && process.env) {
        return process.env.FACILITATOR_URL || "https://facilitator.aeon.xyz";
    }
    // Fallback for browser environment
    return "https://facilitator.aeon.xyz";
}

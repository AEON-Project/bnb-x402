import {type Config, createConfig, http} from "wagmi";
import {base, bsc, polygon, sei} from "viem/chains";
import {injected, metaMask, walletConnect} from "wagmi/connectors";

const config = createConfig({
    chains: [bsc, base, polygon, sei],
    connectors: [
        metaMask(),
        // coinbaseWallet({ appName: "AeonGPT x402" }),
        walletConnect({projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? ""}),
        injected({shimDisconnect: true, target: "phantom"})
    ],
    transports: {
        [bsc.id]: http("https://few-boldest-spring.bsc.quiknode.pro/ec468d8a1ea2c310457b2e2f4eea257e62ba3b1e/"),
        [base.id]: http(),
        [polygon.id]: http(),
        [sei.id]: http(),
    },
}) as Config;

export {config};

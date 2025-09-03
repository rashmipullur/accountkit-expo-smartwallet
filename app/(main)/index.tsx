import { useUser, useSmartAccountClient } from "@account-kit/react-native";
import { StyleSheet, View, Text, Linking, ScrollView, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { encodeFunctionData, formatEther, parseAbi } from "viem";
import WalletHomePage from "@/src/components/home/HomePage";

export default function TabOneScreen() {
  const user = useUser();
  // console.log("User info:", user);

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState("");
  const [balances, setBalances] = useState({
    eth: "0",
    usdc: "0"
  });
  
  const { bottom } = useSafeAreaInsets();
  const { client } = useSmartAccountClient({
    type: "ModularAccountV2",
  });

  const account = client?.account;
  
  // Base Sepolia USDC contract address
//   const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
  const BASE_SEPOLIA_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; //actual usdc address

  if (!user) return null;

  useEffect(() => {
    if (client && account?.address) {
      loadBalances();
    }
  }, [client, account?.address]);

  const loadBalances = async () => {
    if (!client || !account?.address) return;

    try {
      // Get ETH balance
      const ethBalance = await client.getBalance({ address: account.address });
      const ethFormatted = formatEther(ethBalance);

      // Get USDC balance
      const usdcBalance = await client.readContract({
        address: BASE_SEPOLIA_USDC,
        abi: parseAbi([
          'function balanceOf(address owner) view returns (uint256)'
        ]),
        functionName: 'balanceOf',
        args: [account.address]
      });

      const usdcFormatted = (Number(usdcBalance) / 1e6).toFixed(2); // USDC has 6 decimals

      setBalances({
        eth: parseFloat(ethFormatted).toFixed(6),
        usdc: usdcFormatted
      });

    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadBalances();
    setIsRefreshing(false);
  };

  const checkDetailedBalance = async () => {
    if (!client || !account?.address) {
      Alert.alert("Error", "Smart account client not ready");
      return;
    }

    try {
      await loadBalances();
      
      Alert.alert(
        "Account Balances", 
        `Address: ${account.address}\n\nETH: ${balances.eth}\nUSDC: ${balances.usdc}\n\nNote: You need ETH for gas fees to send transactions.`
      );
      
    } catch (error) {
      console.error('Balance check failed:', error);
      Alert.alert("Error", `Failed to check balance: ${error.message}`);
    }
  };

  const sendUSDCTransfer = async () => {
  if (!client || !account?.address) {
    Alert.alert("Error", "Smart account client not ready");
    return;
  }

  // Check if we have USDC and ETH
  const ethBalance = parseFloat(balances.eth);
  const usdcBalance = parseFloat(balances.usdc);

  if (ethBalance < 0.001) {
    Alert.alert(
      "Insufficient ETH", 
      `You need Base Sepolia ETH for gas fees.\n\nCurrent ETH: ${balances.eth}\nGet ETH from: https://faucet.quicknode.com/base/sepolia`
    );
    return;
  }

  if (usdcBalance < 0.1) {
    Alert.alert(
      "Insufficient USDC", 
      `Current USDC: ${balances.usdc}\nGet more from: https://faucet.circle.com/`
    );
    return;
  }

  setIsLoading(true);
  setTransactionStatus("Sending USDC transfer...");

  try {
    const { hash } = await client.sendUserOperation({
      uo: {
        target: BASE_SEPOLIA_USDC,
        data: encodeFunctionData({
          abi: parseAbi([
            'function transfer(address to, uint256 amount) returns (bool)'
          ]),
          functionName: 'transfer',
          args: [
            '0xF62177704d06a8C9d97622f44fbC9EBC6a667ACA', // test recipient
            BigInt(100000) // 0.1 USDC (6 decimals)
          ]
        }),
        value: 0n,
      },
    });

    // Show full hash - no slicing!
    setTransactionStatus(`USDC transfer sent! User Op Hash: ${hash}`);
    Alert.alert("Success!", `USDC transfer sent!\n\nUser Operation Hash:\n${hash}`);

    // Wait for confirmation
    const receipt = await client.waitForUserOperationTransaction({ hash });
    
    // Check if receipt and transactionHash exist before using
    if (receipt?.transactionHash) {
      setTransactionStatus(`USDC transfer confirmed!\n\nTransaction Hash:\n${receipt.transactionHash}`);
    } else {
      setTransactionStatus(`USDC transfer completed!\n\nUser Op Hash:\n${hash}`);
    }
    
    // Refresh balances
    await loadBalances();

  } catch (error) {
    console.error('USDC transfer failed:', error);
    setTransactionStatus(`Failed: ${error.message}`);
    Alert.alert("USDC Transfer Failed", error.message);
  } finally {
    setIsLoading(false);
  }
};

  const sendETHTransfer = async () => {
  if (!client || !account?.address) {
    Alert.alert("Error", "Smart account client not ready");
    return;
  }

  const ethBalance = parseFloat(balances.eth);

  if (ethBalance < 0.002) {
    Alert.alert(
      "Insufficient ETH", 
      `You need more Base Sepolia ETH.\n\nCurrent: ${balances.eth} ETH\nNeed: ~0.002 ETH minimum\n\nGet more from faucets.`
    );
    return;
  }

  setIsLoading(true);
  setTransactionStatus("Sending ETH transfer...");

  try {
    const { hash } = await client.sendUserOperation({
      uo: {
        target: '0x742d35Cc6634C0532925a3b8D400c1dFA0B00a2A',
        data: '0x', 
        value: BigInt('1000000000000000'), // 0.001 ETH
      },
    });

    // Show full hash - no slicing!
    setTransactionStatus(`ETH transfer sent! User Op Hash: ${hash}`);
    Alert.alert("Success!", `ETH transfer sent!\n\nUser Operation Hash:\n${hash}`);

    const receipt = await client.waitForUserOperationTransaction({ hash });
    
    // Safe check before accessing transactionHash
    if (receipt?.transactionHash) {
      setTransactionStatus(`ETH transfer confirmed!\n\nTransaction Hash:\n${receipt.transactionHash}`);
    } else {
      setTransactionStatus(`ETH transfer completed!\n\nUser Op Hash:\n${hash}`);
    }
    
    // Refresh balances
    await loadBalances();

  } catch (error) {
    console.error('ETH transfer failed:', error);
    setTransactionStatus(`Failed: ${error.message}`);
    Alert.alert("ETH Transfer Failed", error.message);
  } finally {
    setIsLoading(false);
  }
};

  const openFaucets = () => {
    Alert.alert(
      "Get Test Tokens",
      "Choose which faucet to open:",
      [
        {
          text: "Base Sepolia ETH",
          onPress: () => Linking.openURL("https://faucet.quicknode.com/base/sepolia")
        },
        {
          text: "Base Sepolia USDC", 
          onPress: () => Linking.openURL("https://faucet.circle.com/")
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  // Add this debug function to your component to troubleshoot the USDC balance issue

const debugBalances = async () => {
  if (!client || !account?.address || !user?.address) {
    Alert.alert("Error", "Account not ready");
    return;
  }

  console.log("=== DEBUG BALANCE CHECK ===");
  
  try {
    // Check current network
    const chainId = await client.getChainId();
    console.log("Current Chain ID:", chainId);
    console.log("Expected Base Sepolia Chain ID: 84532");
    
    // Check both addresses
    const smartAccountAddress = account.address;
    const userEOAAddress = user.address;
    
    console.log("Smart Account Address:", smartAccountAddress);
    console.log("User EOA Address:", userEOAAddress);
    
    // Base Sepolia USDC contract
    const BASE_SEPOLIA_USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
    
    // Check USDC balance on both addresses
    try {
      const usdcBalanceSmartAccount = await client.readContract({
        address: BASE_SEPOLIA_USDC,
        abi: parseAbi([
          'function balanceOf(address owner) view returns (uint256)'
        ]),
        functionName: 'balanceOf',
        args: [smartAccountAddress]
      });

      const usdcBalanceEOA = await client.readContract({
        address: BASE_SEPOLIA_USDC,
        abi: parseAbi([
          'function balanceOf(address owner) view returns (uint256)'
        ]),
        functionName: 'balanceOf',
        args: [userEOAAddress]
      });

      const smartAccountUSDC = (Number(usdcBalanceSmartAccount) / 1e6).toFixed(6);
      const eoaUSDC = (Number(usdcBalanceEOA) / 1e6).toFixed(6);

      console.log("USDC Balance - Smart Account:", smartAccountUSDC);
      console.log("USDC Balance - EOA:", eoaUSDC);

      // Check ETH balances too
      const ethBalanceSmart = await client.getBalance({ address: smartAccountAddress });
      const ethBalanceEOA = await client.getBalance({ address: userEOAAddress });

      console.log("ETH Balance - Smart Account:", formatEther(ethBalanceSmart));
      console.log("ETH Balance - EOA:", formatEther(ethBalanceEOA));

      Alert.alert(
        "Debug Results",
        `Chain ID: ${chainId} ${chainId === 84532 ? '✅' : '❌ Wrong network!'}\n\n` +
        `Smart Account USDC: ${smartAccountUSDC}\n` +
        `EOA USDC: ${eoaUSDC}\n\n` +
        `Smart Account ETH: ${formatEther(ethBalanceSmart)}\n` +
        `EOA ETH: ${formatEther(ethBalanceEOA)}\n\n` +
        `${chainId !== 84532 ? 'Switch to Base Sepolia network!' : ''}` +
        `${Number(eoaUSDC) > 0 && Number(smartAccountUSDC) === 0 ? '\n\nUSDC is on your EOA, not smart account!' : ''}`
      );

    } catch (contractError) {
      console.log("Contract read error:", contractError);
      Alert.alert(
        "Contract Error", 
        `Failed to read USDC contract.\n\nChain ID: ${chainId}\nExpected: 84532 (Base Sepolia)\n\nError: ${contractError.message}`
      );
    }

  } catch (error) {
    console.error('Debug failed:', error);
    Alert.alert("Debug Failed", error.message);
  }
};

// Also add this function to transfer USDC from EOA to Smart Account if needed
const transferUSDCToSmartAccount = async () => {
  if (!client || !account?.address || !user?.address) {
    Alert.alert("Error", "Account not ready");
    return;
  }

  Alert.alert(
    "Transfer USDC to Smart Account",
    `Your USDC might be on your EOA address instead of your smart account.\n\nEOA: ${user.address}\nSmart Account: ${account.address}\n\nTo use USDC with Account Kit, you need to transfer it to your smart account first.`,
    [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "How to Transfer",
        onPress: () => Alert.alert(
          "How to Transfer",
          "1. Open MetaMask or your wallet\n2. Connect to Base Sepolia\n3. Send USDC to your smart account address:\n\n" + account.address
        )
      }
    ]
  );
};


  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      <WalletHomePage />
      <View style={styles.container}>
        <Text style={[styles.userText, { fontSize: 50 }]}>
          Welcome!
        </Text>
        <Text style={styles.userText}>{user.email}</Text>
        <View style={styles.separator} />

        {/* User Details */}
        <View>
          <Text style={styles.userText}>OrgId: {user.orgId}</Text>
          <Text style={styles.userText}>Address: {user.address}</Text>
          <Text style={styles.userText}>
            Smart Account: {account?.address}
          </Text>
        </View>

        <View style={styles.separator} />

        {/* Balance Section */}
        <View style={styles.balanceSection}>
          <Text style={[styles.userText, { fontSize: 24, fontWeight: 'bold' }]}>
            Account Balances
          </Text>
          
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>ETH:</Text>
              <Text style={[styles.balanceValue, { 
                color: parseFloat(balances.eth) > 0.001 ? '#22c55e' : '#ef4444' 
              }]}>
                {balances.eth}
              </Text>
            </View>
            
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>USDC:</Text>
              <Text style={[styles.balanceValue, { 
                color: parseFloat(balances.usdc) > 0 ? '#22c55e' : '#6b7280' 
              }]}>
                {balances.usdc}
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, styles.infoButton]} 
            onPress={checkDetailedBalance}
          >
            <Text style={[styles.buttonText, { color: '#333' }]}>
              Check Detailed Balance
            </Text>
          </TouchableOpacity>
        </View>



		<TouchableOpacity 
		style={[styles.button, styles.secondaryButton]} 
		onPress={debugBalances}
		>
		<Text style={[styles.buttonText, { color: '#333' }]}>
			Debug Balance Issue
		</Text>
		</TouchableOpacity>

		<TouchableOpacity 
		style={[styles.button, styles.secondaryButton]} 
		onPress={transferUSDCToSmartAccount}
		>
		<Text style={[styles.buttonText, { color: '#333' }]}>
			Transfer USDC to Smart Account
		</Text>
		</TouchableOpacity>




        <View style={styles.separator} />

        {/* Transaction Testing Section */}
        <View style={styles.transactionSection}>
          <Text style={[styles.userText, { fontSize: 24, fontWeight: 'bold' }]}>
            Transaction Testing
          </Text>
          
          {/* Get Test Tokens */}
          <TouchableOpacity 
            style={[styles.button, styles.faucetButton]} 
            onPress={openFaucets}
          >
            <Text style={styles.buttonText}>
              Get Test Tokens (Faucets)
            </Text>
          </TouchableOpacity>

          {/* USDC Transfer */}
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton]} 
            onPress={sendUSDCTransfer}
            disabled={isLoading || parseFloat(balances.usdc) === 0}
          >
            <Text style={styles.buttonText}>
              {isLoading ? "Sending..." : `Send 0.1 USDC (Have: ${balances.usdc})`}
            </Text>
          </TouchableOpacity>

          {/* ETH Transfer */}
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]} 
            onPress={sendETHTransfer}
            disabled={isLoading || parseFloat(balances.eth) < 0.002}
          >
            <Text style={[styles.buttonText, { color: '#333' }]}>
              {isLoading ? "Sending..." : `Send 0.001 ETH (Have: ${balances.eth})`}
            </Text>
          </TouchableOpacity>

          {/* Gas Fee Warning */}
          {parseFloat(balances.eth) < 0.001 && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ You need Base Sepolia ETH for gas fees to send any transactions.
              </Text>
            </View>
          )}

          {/* Transaction Status */}
          {transactionStatus ? (
            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>{transactionStatus}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.separator} />

        {/* Documentation Info */}
        <View style={{ marginTop: "auto", marginBottom: bottom + 40 }}>
          <Text style={[styles.userText, { marginBottom: 20 }]}>
            Now that you have a smart account setup, visit our docs
            to learn how to use this account to send sponsored and
            unsponsored user operations
          </Text>

          <Text
            onPress={() =>
              Linking.openURL(
                "https://accountkit.alchemy.com/react-native/using-smart-accounts/send-user-operations"
              )
            }
            style={[styles.userText, styles.documentationLink]}
          >
            https://accountkit.alchemy.com/react-native/using-smart-accounts/send-user-operations
          </Text>
        </View>
        <TouchableOpacity 
            style={[styles.button, styles.infoButton]} 
            onPress={checkDetailedBalance}
          >
            <Text style={[styles.buttonText, { color: '#333' }]}>
             log out
            </Text>
          </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingTop: 20,
    paddingHorizontal: 15,
    backgroundColor: "white",
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: "80%",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "black",
  },
  userText: {
    marginBottom: 10,
    fontSize: 18,
    fontFamily: "SpaceMono",
  },
  documentationLink: {
    fontSize: 16,
    padding: 5,
    backgroundColor: "rgba(233,70,186,0.15)",
    borderRadius: 4,
    color: "#e946ba",
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e946ba",
  },
  balanceSection: {
    marginVertical: 20,
  },
  balanceCard: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 5,
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: "SpaceMono",
    color: "#333",
  },
  balanceValue: {
    fontSize: 16,
    fontFamily: "SpaceMono",
    fontWeight: 'bold',
  },
  transactionSection: {
    marginVertical: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginVertical: 6,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: "#e946ba",
  },
  secondaryButton: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  faucetButton: {
    backgroundColor: "#3b82f6",
  },
  infoButton: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: "white",
    fontFamily: "SpaceMono",
    textAlign: 'center',
  },
  statusContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#e946ba",
  },
  statusText: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    color: "#333",
  },
  warningContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#fef3cd",
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  warningText: {
    fontSize: 12,
    fontFamily: "SpaceMono",
    color: "#92400e",
  },
});
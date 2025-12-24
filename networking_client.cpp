// tcp_client.cpp
// #include <winsock2.h>
// #include <iostream>

// #pragma comment(lib, "ws2_32.lib") // Link against Winsock library

// using namespace std;

// int main() {
//     WSADATA wsaData;
//     SOCKET clientSocket;
//     sockaddr_in serverAddr;
//     char buffer[1024];

//     // Initialize Winsock
//     cout << "------------ Initialize Winsock --------------" << endl;
//     if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
//         cerr << "WSAStartup failed!\n";
//         return 1;
//     } else {
//         cout << "Winsock initialized successfully.\n";
//     }

//     // Create socket
//     cout << "-------------- Create a Socket ---------------" << endl;
//     clientSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
//     if (clientSocket == INVALID_SOCKET) {
//         cerr << "Socket creation failed!\n";
//         WSACleanup();
//         return 1;
//     } else {
//         cout << "Socket created successfully.\n";
//     }

//     // Setup server details
//     serverAddr.sin_family = AF_INET;
//     serverAddr.sin_port = htons(8080); // Server port
//     serverAddr.sin_addr.s_addr = inet_addr("127.0.0.1"); // Localhost
//     memset(&(serverAddr.sin_zero), 0, 8);

//     // Connect to server
//     cout << "------------------ Connect -------------------" << endl;
//     if (connect(clientSocket, (SOCKADDR*)&serverAddr, sizeof(serverAddr)) < 0) {
//         cerr << "Connection to server failed!\n";
//         closesocket(clientSocket);
//         WSACleanup();
//         return 1;
//     } else {
//         cout << "Connected to server!\n";
//     }

//     // Send message
//     string message = "Hello server!";
//     send(clientSocket, message.c_str(), message.size(), 0);
//     cout << "Message sent to server.\n";

//     // Receive reply
//     memset(buffer, 0, sizeof(buffer));
//     int bytesReceived = recv(clientSocket, buffer, sizeof(buffer), 0);
//     if (bytesReceived > 0) {
//         cout << "Server replied: " << buffer << endl;
//     }

//     // Clean up
//     closesocket(clientSocket);
//     WSACleanup();
//     cout << "Client socket closed.\n";

//     return 0;
// }


// loop the message while manually user can stop
// tcp_client.cpp

#include <winsock2.h>
#include <iostream>
#include <string>
#pragma comment(lib, "ws2_32.lib")

using namespace std;

int main() {
    WSADATA wsaData;
    SOCKET clientSocket;
    sockaddr_in serverAddr;
    char buffer[1024];

    WSAStartup(MAKEWORD(2, 2), &wsaData);

    clientSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(8080);
    serverAddr.sin_addr.s_addr = inet_addr("172.17.24.64");
    memset(&(serverAddr.sin_zero), 0, 8);

    connect(clientSocket, (SOCKADDR*)&serverAddr, sizeof(serverAddr));
    cout << "Connected to server!\n";

    while (true) {
        cout << "Client: ";
        string message;
        getline(cin, message);

        send(clientSocket, message.c_str(), message.length(), 0);
        if (message == "exit") break;

        memset(buffer, 0, sizeof(buffer));
        int bytesReceived = recv(clientSocket, buffer, sizeof(buffer), 0);
        if (bytesReceived <= 0) {
            cout << "Server disconnected.\n";
            break;
        }

        cout << "\nServer: " << buffer << endl;
        if (string(buffer) == "exit") break;
    }

    closesocket(clientSocket);
    WSACleanup();
    return 0;
}

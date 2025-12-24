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

    // Create TCP socket
    clientSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(8080);
    serverAddr.sin_addr.s_addr = inet_addr("127.0.0.1");
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

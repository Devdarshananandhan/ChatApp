// command to run cd "e:\C++ project\" ; if ($?) { g++ networking_sever.cpp -o networking_server.exe -lws2_32 } ; if ($?) { .\networking_server.exe }


// server socket
// tcp server.cpp
// #include <winsock2.h>
// #include <iostream>

// #pragma comment(lib, "ws2_32.lib")  // Link Winsock library

// using namespace std;

// int main() {
//     WSADATA wsaData;
//     SOCKET serverSocket, clientSocket;
//     sockaddr_in serverAddr, clientAddr;
//     int clientSize;
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
//     serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
//     if (serverSocket == INVALID_SOCKET) {
//         cerr << "Socket creation failed!\n";
//         WSACleanup();
//         return 1;
//     } else {
//         cout << "Socket created successfully.\n";
//     }

//     // Bind socket
//     cout << "------------------ Bind Socket ----------------" << endl;
//     serverAddr.sin_family = AF_INET;
//     serverAddr.sin_port = htons(8080);
//     serverAddr.sin_addr.s_addr = INADDR_ANY;
//     memset(&(serverAddr.sin_zero), 0, 8);

//     if (bind(serverSocket, (SOCKADDR*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
//         cerr << "Bind failed!\n";
//         closesocket(serverSocket);
//         WSACleanup();
//         return 1;
//     } else {
//         cout << "Socket bound to port 8080 successfully.\n";
//     }

//     // Listen for connections
//     cout << "------------------ Listen ---------------------" << endl;
//     if (listen(serverSocket, 3) == SOCKET_ERROR) {
//         cerr << "Listen failed!\n";
//         closesocket(serverSocket);
//         WSACleanup();
//         return 1;
//     } else {
//         cout << "Server is listening on port 8080...\n";
//     }

//     // Accept incoming connection
//     clientSize = sizeof(clientAddr);
//     clientSocket = accept(serverSocket, (SOCKADDR*)&clientAddr, &clientSize);
//     if (clientSocket == INVALID_SOCKET) {
//         cerr << "Accept failed!\n";
//         closesocket(serverSocket);
//         WSACleanup();
//         return 1;
//     } else {
//         cout << "Client connected!\n";
//     }

//     // Communicate with client (optional)
//     memset(buffer, 0, sizeof(buffer));
//     int bytesReceived = recv(clientSocket, buffer, sizeof(buffer), 0);
//     if (bytesReceived > 0) {
//         cout << "Client says: " << buffer << endl;

//         string reply = "Message received.";
//         send(clientSocket, reply.c_str(), reply.size(), 0);
//     }

//     // Clean up
//     closesocket(clientSocket);
//     closesocket(serverSocket);
//     WSACleanup();
//     cout << "Server closed.\n";

//     return 0;
// }


// loop the message while user stop 
// tcp_server.cpp

#include <winsock2.h>
#include <iostream>
#include <string>
#include <cstring>

#include <unordered_map>
#include <unordered_set>
#include <vector>
#include <mutex>
#include <thread>

#pragma comment(lib, "ws2_32.lib")

using namespace std;

namespace {
    mutex gMutex;
    unordered_map<string, SOCKET> gUserToSocket;
    unordered_map<SOCKET, string> gSocketToUser;
    unordered_map<string, unordered_set<string>> gRoomToUsers;

    vector<string> splitPipe(const string& s) {
        vector<string> parts;
        string cur;
        for (char c : s) {
            if (c == '|') {
                parts.push_back(cur);
                cur.clear();
            } else {
                cur.push_back(c);
            }
        }
        parts.push_back(cur);
        return parts;
    }

    void sendLine(SOCKET s, const string& line) {
        string out = line;
        out += "\n";
        send(s, out.c_str(), static_cast<int>(out.size()), 0);
    }

    void broadcastUsersLocked() {
        string payload = "USERS|";
        bool first = true;
        for (const auto& kv : gUserToSocket) {
            if (!first) payload += ",";
            payload += kv.first;
            first = false;
        }
        payload += "|";

        for (const auto& kv : gUserToSocket) {
            sendLine(kv.second, payload);
        }
    }

    void broadcastRoomsLocked() {
        string payload = "ROOMS|";
        bool first = true;
        for (const auto& kv : gRoomToUsers) {
            if (!first) payload += ",";
            payload += kv.first;
            first = false;
        }
        payload += "|";

        for (const auto& kv : gUserToSocket) {
            sendLine(kv.second, payload);
        }
    }

    void broadcastInfoLocked(const string& text) {
        for (const auto& kv : gUserToSocket) {
            sendLine(kv.second, "INFO||" + text);
        }
    }

    void cleanupUserLocked(SOCKET s) {
        auto itU = gSocketToUser.find(s);
        if (itU == gSocketToUser.end()) return;
        const string user = itU->second;

        gSocketToUser.erase(itU);
        gUserToSocket.erase(user);

        for (auto& roomKv : gRoomToUsers) {
            roomKv.second.erase(user);
        }
    }

    void handleLine(SOCKET s, const string& line) {
        const string trimmed = (!line.empty() && line.back() == '\r') ? line.substr(0, line.size() - 1) : line;
        if (trimmed.empty()) return;

        const auto parts = splitPipe(trimmed);
        const string cmd = parts.size() > 0 ? parts[0] : "";
        const string a = parts.size() > 1 ? parts[1] : "";
        const string b = parts.size() > 2 ? parts[2] : "";

        if (cmd == "HELLO") {
            lock_guard<mutex> lock(gMutex);
            if (a.empty()) {
                sendLine(s, "ERROR||Username required");
                return;
            }
            if (gUserToSocket.find(a) != gUserToSocket.end()) {
                sendLine(s, "ERROR||Username already in use");
                return;
            }
            gUserToSocket[a] = s;
            gSocketToUser[s] = a;
            sendLine(s, "WELCOME|" + a + "|");
            broadcastInfoLocked(a + " joined");
            broadcastUsersLocked();
            broadcastRoomsLocked();
            return;
        }

        string from;
        {
            lock_guard<mutex> lock(gMutex);
            auto it = gSocketToUser.find(s);
            if (it != gSocketToUser.end()) from = it->second;
        }
        if (from.empty()) {
            sendLine(s, "ERROR||Send HELLO|<username> first");
            return;
        }

        if (cmd == "MSG") {
            lock_guard<mutex> lock(gMutex);
            auto itTo = gUserToSocket.find(a);
            if (itTo == gUserToSocket.end()) {
                sendLine(s, "ERROR||User not online");
                return;
            }
            sendLine(itTo->second, "FROM|" + from + "|" + b);
            return;
        }

        if (cmd == "JOIN") {
            lock_guard<mutex> lock(gMutex);
            if (a.empty()) {
                sendLine(s, "ERROR||Room name required");
                return;
            }
            gRoomToUsers[a].insert(from);
            broadcastInfoLocked(from + " joined room " + a);
            broadcastRoomsLocked();
            return;
        }

        if (cmd == "LEAVE") {
            lock_guard<mutex> lock(gMutex);
            if (a.empty()) {
                sendLine(s, "ERROR||Room name required");
                return;
            }
            auto itRoom = gRoomToUsers.find(a);
            if (itRoom != gRoomToUsers.end()) {
                itRoom->second.erase(from);
            }
            broadcastInfoLocked(from + " left room " + a);
            broadcastRoomsLocked();
            return;
        }

        if (cmd == "ROOMMSG") {
            lock_guard<mutex> lock(gMutex);
            auto itRoom = gRoomToUsers.find(a);
            if (itRoom == gRoomToUsers.end() || itRoom->second.find(from) == itRoom->second.end()) {
                sendLine(s, "ERROR||Join the room first");
                return;
            }
            for (const auto& user : itRoom->second) {
                auto itSock = gUserToSocket.find(user);
                if (itSock != gUserToSocket.end()) {
                    sendLine(itSock->second, "ROOMFROM|" + a + "|" + from + ": " + b);
                }
            }
            return;
        }

        if (cmd == "LIST") {
            lock_guard<mutex> lock(gMutex);
            broadcastUsersLocked();
            broadcastRoomsLocked();
            return;
        }

        if (cmd == "EXIT") {
            shutdown(s, SD_BOTH);
            return;
        }

        sendLine(s, "ERROR||Unknown command");
    }

    void clientThread(SOCKET clientSocket) {
        string pending;
        char buf[2048];

        while (true) {
            const int n = recv(clientSocket, buf, sizeof(buf), 0);
            if (n <= 0) break;
            pending.append(buf, buf + n);

            size_t pos = 0;
            while (true) {
                const size_t nl = pending.find('\n', pos);
                if (nl == string::npos) {
                    pending.erase(0, pos);
                    break;
                }
                const string line = pending.substr(pos, nl - pos);
                pos = nl + 1;
                handleLine(clientSocket, line);
            }
        }

        {
            lock_guard<mutex> lock(gMutex);
            auto it = gSocketToUser.find(clientSocket);
            if (it != gSocketToUser.end()) {
                const string user = it->second;
                cleanupUserLocked(clientSocket);
                broadcastInfoLocked(user + " disconnected");
                broadcastUsersLocked();
            }
        }

        closesocket(clientSocket);
    }
}

int main() {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        cout << "WSAStartup failed\n";
        return 1;
    }

    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket == INVALID_SOCKET) {
        cout << "Socket creation failed\n";
        WSACleanup();
        return 1;
    }

    sockaddr_in serverAddr{};
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port = htons(8080);
    serverAddr.sin_addr.s_addr = INADDR_ANY;

    if (bind(serverSocket, (SOCKADDR*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        cout << "Bind failed\n";
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    if (listen(serverSocket, SOMAXCONN) == SOCKET_ERROR) {
        cout << "Listen failed\n";
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    cout << "Multi-client chat server listening on port 8080...\n";

    while (true) {
        sockaddr_in clientAddr{};
        int clientSize = sizeof(clientAddr);
        SOCKET clientSocket = accept(serverSocket, (SOCKADDR*)&clientAddr, &clientSize);
        if (clientSocket == INVALID_SOCKET) {
            cout << "Accept failed\n";
            continue;
        }

        thread t(clientThread, clientSocket);
        t.detach();
    }

    closesocket(serverSocket);
    WSACleanup();
    return 0;
}

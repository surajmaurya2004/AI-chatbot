const API_URL = "http://localhost:5000/api/chat";
const NEW_CHAT_URL = "http://localhost:5000/api/new-chat";


// ===============================
// DOM ELEMENTS
// ===============================

const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const chatBox = document.getElementById("chatBox");
const newChatBtn = document.getElementById("newChatBtn");

const chatList =
    document.getElementById("chatHistoryList");

const menuBtn =
    document.getElementById("menuBtn");

const sidebar =
    document.getElementById("sidebar");

const sidebarNewChatBtn =
    document.getElementById("sidebarNewChatBtn");

const closeSidebarBtn =
    document.getElementById("closeSidebarBtn");

const chatSearch =
    document.getElementById("chatSearch");


// ===============================
// CHAT DATA
// ===============================

let chats =
    JSON.parse(
        localStorage.getItem("myChats")
    ) || [];

let currentChatId =
    localStorage.getItem("currentChatId") || null;

let lastUserMessage = "";


// ===============================
// INITIALIZE
// ===============================

initializeChats();


// ===============================
// EVENT LISTENERS
// ===============================

sendBtn.addEventListener(
    "click",
    sendMessage
);

newChatBtn.addEventListener(
    "click",
    newChat
);


// Sidebar New Chat

if (sidebarNewChatBtn) {

    sidebarNewChatBtn.addEventListener(
        "click",
        newChat
    );

}


// Enter

input.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


// ===============================
// SIDEBAR OPEN / CLOSE
// ===============================

if (menuBtn) {

    menuBtn.addEventListener(
        "click",
        function () {

            sidebar.classList.toggle(
                "active"
            );

        }
    );

}


if (closeSidebarBtn) {

    closeSidebarBtn.addEventListener(
        "click",
        function () {

            sidebar.classList.remove(
                "active"
            );

        }
    );

}


// ===============================
// SEARCH CHAT HISTORY
// ===============================

if (chatSearch) {

    chatSearch.addEventListener(
        "input",
        function () {

            renderChatList(
                chatSearch.value
            );

        }
    );

}


// ===============================
// INITIALIZE CHATS
// ===============================

function initializeChats() {

    if (chats.length === 0) {

        createLocalChat();

        return;

    }

    let currentChat =
        chats.find(
            chat =>
                chat.id === currentChatId
        );

    if (!currentChat) {

        currentChatId =
            chats[0].id;

        currentChat =
            chats[0];

        saveChats();

    }

    loadChat(
        currentChat.id
    );

}


// ===============================
// CREATE CHAT
// ===============================

function createLocalChat() {

    const chat = {

        id:
            Date.now().toString(),

        title:
            "New Chat",

        messages:
            []

    };

    chats.unshift(chat);

    currentChatId =
        chat.id;

    saveChats();

    renderChatList();

    showWelcomeMessage();

}


// ===============================
// SAVE
// ===============================

function saveChats() {

    localStorage.setItem(
        "myChats",
        JSON.stringify(chats)
    );

    localStorage.setItem(
        "currentChatId",
        currentChatId || ""
    );

}


// ===============================
// GET CURRENT CHAT
// ===============================

function getCurrentChat() {

    return chats.find(
        chat =>
            chat.id === currentChatId
    );

}


// ===============================
// SEND MESSAGE
// ===============================

async function sendMessage(
    messageFromRegenerate = null
) {

    const message =
        messageFromRegenerate ||
        input.value.trim();

    if (!message) return;

    let currentChat =
        getCurrentChat();

    if (!currentChat) {

        createLocalChat();

        currentChat =
            getCurrentChat();

    }


    // USER MESSAGE

    if (!messageFromRegenerate) {

        addMessage(
            message,
            "user"
        );

        input.value = "";

        currentChat.messages.push({

            role: "user",

            content: message

        });


        // TITLE

        if (
            currentChat.title === "New Chat" &&
            currentChat.messages.length === 1
        ) {

            currentChat.title =
                createChatTitle(message);

        }

        saveChats();

        renderChatList();

    }


    lastUserMessage =
        message;

    sendBtn.disabled =
        true;


    // BOT MESSAGE

    const botMessage =
        addMessage(
            "",
            "bot"
        );


    try {

        const response =
            await fetch(
                API_URL,
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            message: message,

                            chatId:
                                currentChatId

                        })

                }
            );


        if (!response.ok) {

            let errorData;

            try {

                errorData =
                    await response.json();

            } catch {

                errorData = {
                    error: "Server error"
                };

            }

            botMessage.textContent =
                "❌ " +
                (
                    typeof errorData.error === "string"
                        ? errorData.error
                        : JSON.stringify(
                            errorData.error
                        )
                );

            return;

        }


        // STREAMING

        const reader =
            response.body.getReader();

        const decoder =
            new TextDecoder();

        let buffer = "";


        while (true) {

            const {
                value,
                done
            } =
                await reader.read();

            if (done) break;


            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );


            const lines =
                buffer.split("\n");

            buffer =
                lines.pop();


            for (
                const line of lines
            ) {

                if (
                    !line.startsWith("data:")
                ) continue;


                const jsonText =
                    line.substring(5).trim();

                if (!jsonText) continue;


                try {

                    const data =
                        JSON.parse(
                            jsonText
                        );


                    if (data.text) {

                        botMessage.dataset.rawText =
                            (
                                botMessage.dataset.rawText ||
                                ""
                            ) +
                            data.text;


                        botMessage.innerHTML =
                            marked.parse(
                                botMessage.dataset.rawText
                            );


                        chatBox.scrollTop =
                            chatBox.scrollHeight;

                    }

                } catch (error) {

                    console.log(
                        "Chunk error:",
                        error
                    );

                }

            }

        }


        // SAVE BOT RESPONSE

        const botText =
            botMessage.dataset.rawText ||
            botMessage.textContent;


        const chat =
            getCurrentChat();


        if (chat) {

            chat.messages.push({

                role: "assistant",

                content: botText

            });

            saveChats();

        }


        addCopyButton(
            botMessage
        );

        addRegenerateButton(
            botMessage
        );


    } catch (error) {

        console.error(error);

        botMessage.textContent =
            "❌ Cannot connect to backend.";

    } finally {

        sendBtn.disabled =
            false;

        input.focus();

    }

}


// ===============================
// ADD MESSAGE
// ===============================

function addMessage(
    text,
    type
) {

    const messageDiv =
        document.createElement("div");

    messageDiv.classList.add(
        "message",
        type
    );


    if (
        type === "bot" &&
        text
    ) {

        messageDiv.innerHTML =
            marked.parse(text);

        messageDiv.dataset.rawText =
            text;

    } else {

        messageDiv.textContent =
            text;

    }


    chatBox.appendChild(
        messageDiv
    );

    chatBox.scrollTop =
        chatBox.scrollHeight;


    return messageDiv;

}


// ===============================
// COPY
// ===============================

function addCopyButton(
    botMessage
) {

    const copyButton =
        document.createElement("button");

    copyButton.textContent =
        "📋 Copy";

    copyButton.classList.add(
        "copy-btn"
    );


    copyButton.addEventListener(
        "click",
        async function () {

            const textToCopy =
                botMessage.dataset.rawText ||
                botMessage.textContent;


            try {

                await navigator.clipboard.writeText(
                    textToCopy
                );

                copyButton.textContent =
                    "✅ Copied";

                setTimeout(
                    function () {

                        copyButton.textContent =
                            "📋 Copy";

                    },
                    1500
                );

            } catch (error) {

                console.error(error);

                copyButton.textContent =
                    "❌ Failed";

            }

        }
    );


    botMessage.appendChild(
        copyButton
    );

}


// ===============================
// REGENERATE
// ===============================

function addRegenerateButton(
    botMessage
) {

    const regenerateButton =
        document.createElement("button");

    regenerateButton.textContent =
        "🔄 Regenerate";

    regenerateButton.classList.add(
        "regenerate-btn"
    );


    regenerateButton.addEventListener(
        "click",
        function () {

            botMessage.remove();


            const chat =
                getCurrentChat();


            if (
                chat &&
                chat.messages.length
            ) {

                const lastMessage =
                    chat.messages[
                        chat.messages.length - 1
                    ];


                if (
                    lastMessage.role === "assistant"
                ) {

                    chat.messages.pop();

                    saveChats();

                }

            }


            sendMessage(
                lastUserMessage
            );

        }
    );


    botMessage.appendChild(
        regenerateButton
    );

}


// ===============================
// NEW CHAT
// ===============================

async function newChat() {

    try {

        const response =
            await fetch(
                NEW_CHAT_URL,
                {
                    method: "POST"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Failed to start new chat"
            );

        }


        createLocalChat();

        input.value = "";

        input.focus();


        if (chatSearch) {

            chatSearch.value = "";

        }


        if (sidebar) {

            sidebar.classList.remove(
                "active"
            );

        }

    } catch (error) {

        console.error(error);

        alert(
            "❌ Could not start new chat"
        );

    }

}


// ===============================
// LOAD CHAT
// ===============================

function loadChat(
    chatId
) {

    const chat =
        chats.find(
            chat =>
                chat.id === chatId
        );


    if (!chat) return;


    currentChatId =
        chat.id;


    saveChats();


    chatBox.innerHTML =
        "";


    if (
        !chat.messages ||
        chat.messages.length === 0
    ) {

        showWelcomeMessage();

    } else {

        chat.messages.forEach(
            message => {

                const messageDiv =
                    addMessage(
                        message.content,
                        message.role === "user"
                            ? "user"
                            : "bot"
                    );


                if (
                    message.role === "assistant"
                ) {

                    addCopyButton(
                        messageDiv
                    );

                    addRegenerateButton(
                        messageDiv
                    );

                }

            }
        );

    }


    // Last user message

    const userMessages =
        chat.messages.filter(
            message =>
                message.role === "user"
        );


    if (userMessages.length > 0) {

        lastUserMessage =
            userMessages[
                userMessages.length - 1
            ].content;

    } else {

        lastUserMessage = "";

    }


    renderChatList();


    if (sidebar) {

        sidebar.classList.remove(
            "active"
        );

    }

}


// ===============================
// CHAT LIST + SEARCH
// ===============================

function renderChatList(
    searchText = ""
) {

    if (!chatList) return;


    chatList.innerHTML =
        "";


    const search =
        searchText
            .trim()
            .toLowerCase();


    const filteredChats =
        chats.filter(
            chat =>
                chat.title
                    .toLowerCase()
                    .includes(search)
        );


    filteredChats.forEach(
        chat => {

            const chatItem =
                document.createElement("div");


            chatItem.classList.add(
                "chat-item"
            );


            if (
                chat.id === currentChatId
            ) {

                chatItem.classList.add(
                    "active"
                );

            }


            // TITLE

            const chatTitle =
                document.createElement("span");

            chatTitle.textContent =
                chat.title;

            chatTitle.classList.add(
                "chat-title"
            );


            // DELETE

            const deleteBtn =
                document.createElement("button");

            deleteBtn.textContent =
                "🗑️";

            deleteBtn.classList.add(
                "delete-chat-btn"
            );


            deleteBtn.addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();

                    deleteChat(
                        chat.id
                    );

                }
            );


            // OPEN CHAT

            chatItem.addEventListener(
                "click",
                function () {

                    loadChat(
                        chat.id
                    );

                }
            );


            chatItem.appendChild(
                chatTitle
            );

            chatItem.appendChild(
                deleteBtn
            );

            chatList.appendChild(
                chatItem
            );

        }
    );

}


// ===============================
// DELETE CHAT
// ===============================

function deleteChat(
    chatId
) {

    const confirmDelete =
        confirm(
            "Are you sure you want to delete this chat?"
        );


    if (!confirmDelete) return;


    chats =
        chats.filter(
            chat =>
                chat.id !== chatId
        );


    if (
        currentChatId === chatId
    ) {

        if (chats.length > 0) {

            currentChatId =
                chats[0].id;

            saveChats();

            loadChat(
                currentChatId
            );

        } else {

            currentChatId = null;

            saveChats();

            createLocalChat();

        }

    } else {

        saveChats();

        renderChatList(
            chatSearch
                ? chatSearch.value
                : ""
        );

    }

}


// ===============================
// CHAT TITLE
// ===============================

function createChatTitle(
    message
) {

    let title =
        message.trim();


    title =
        title.replace(
            /\s+/g,
            " "
        );


    if (
        title.length > 30
    ) {

        title =
            title.substring(
                0,
                30
            ) +
            "...";

    }


    return title;

}


// ===============================
// WELCOME
// ===============================

function showWelcomeMessage() {

    chatBox.innerHTML = `

        <div class="message bot">

            Hello! 👋 How can I help you?

        </div>

    `;

}


// ===============================
// PAGE LOAD
// ===============================

renderChatList();
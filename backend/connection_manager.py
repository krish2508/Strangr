class ConnectionManager:

    def __init__(self):
        self.connections = {}

    async def connect(self, user_id, websocket):

        await websocket.accept()
        self.connections[user_id] = websocket

    def disconnect(self, user_id):

        self.connections.pop(user_id, None)

    def get(self, user_id):

        return self.connections.get(user_id)


manager = ConnectionManager()
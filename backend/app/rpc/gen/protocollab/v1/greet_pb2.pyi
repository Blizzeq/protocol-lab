from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Optional as _Optional

DESCRIPTOR: _descriptor.FileDescriptor

class GreetRequest(_message.Message):
    __slots__ = ("name",)
    NAME_FIELD_NUMBER: _ClassVar[int]
    name: str
    def __init__(self, name: _Optional[str] = ...) -> None: ...

class GreetResponse(_message.Message):
    __slots__ = ("greeting", "served_by")
    GREETING_FIELD_NUMBER: _ClassVar[int]
    SERVED_BY_FIELD_NUMBER: _ClassVar[int]
    greeting: str
    served_by: str
    def __init__(self, greeting: _Optional[str] = ..., served_by: _Optional[str] = ...) -> None: ...

class BoardStatsRequest(_message.Message):
    __slots__ = ("board_id",)
    BOARD_ID_FIELD_NUMBER: _ClassVar[int]
    board_id: str
    def __init__(self, board_id: _Optional[str] = ...) -> None: ...

class BoardStatsResponse(_message.Message):
    __slots__ = ("total", "todo", "in_progress", "done", "members")
    TOTAL_FIELD_NUMBER: _ClassVar[int]
    TODO_FIELD_NUMBER: _ClassVar[int]
    IN_PROGRESS_FIELD_NUMBER: _ClassVar[int]
    DONE_FIELD_NUMBER: _ClassVar[int]
    MEMBERS_FIELD_NUMBER: _ClassVar[int]
    total: int
    todo: int
    in_progress: int
    done: int
    members: int
    def __init__(self, total: _Optional[int] = ..., todo: _Optional[int] = ..., in_progress: _Optional[int] = ..., done: _Optional[int] = ..., members: _Optional[int] = ...) -> None: ...

class WatchRequest(_message.Message):
    __slots__ = ("board_id",)
    BOARD_ID_FIELD_NUMBER: _ClassVar[int]
    board_id: str
    def __init__(self, board_id: _Optional[str] = ...) -> None: ...

class BoardEvent(_message.Message):
    __slots__ = ("seq", "type", "task_id")
    SEQ_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    TASK_ID_FIELD_NUMBER: _ClassVar[int]
    seq: int
    type: str
    task_id: str
    def __init__(self, seq: _Optional[int] = ..., type: _Optional[str] = ..., task_id: _Optional[str] = ...) -> None: ...

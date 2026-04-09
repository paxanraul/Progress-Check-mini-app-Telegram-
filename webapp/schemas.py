"""Pydantic-схемы для FastAPI API Mini App."""

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class ApiOkResponse(ApiModel):
    ok: bool = True


class QuoteItem(ApiModel):
    text: str = ""
    author: str = ""


class ExercisePayload(ApiModel):
    exercise: str
    weight: float
    sets: int = 1
    reps: int = 1


class UserIdPayload(ApiModel):
    user_id: int


class ProfileUpdatePayload(UserIdPayload):
    name: str
    weight: float
    height: float
    experience: str = ""


class QuotesUpdatePayload(UserIdPayload):
    quotes: list[QuoteItem] = Field(default_factory=list)


class WorkoutCreatePayload(UserIdPayload):
    workout_date: str
    workout_name: str = ""
    wellbeing_note: str = ""
    exercises: list[ExercisePayload] = Field(default_factory=list)


class WorkoutUpdatePayload(WorkoutCreatePayload):
    source_workout_date: str = ""
    source_session_key: str = ""
    session_key: str = ""


class WorkoutDeletePayload(UserIdPayload):
    workout_date: str = ""
    session_key: str = ""


class RecordCreatePayload(UserIdPayload):
    exercise: str
    best_weight: float
    workout_date: str | None = None
    date: str | None = None


class RecordUpdatePayload(RecordCreatePayload):
    source_exercise: str | None = None
    source_workout_date: str | None = None
    source_date: str | None = None


class RecordDeletePayload(UserIdPayload):
    exercise: str = ""


class HistoryExerciseResponse(ApiModel):
    exercise: str
    weight: str
    sets: int
    reps: int


class HistoryDayResponse(ApiModel):
    session_key: str
    date: str
    workout_name: str
    note: str
    exercises: list[HistoryExerciseResponse]


class RecordResponse(ApiModel):
    exercise: str
    best_weight: str
    date: str


class UserResponse(ApiModel):
    name: str
    weight: str | None = None
    height: str | None = None
    experience: str
    workout_days: int


class AppDataResponse(ApiModel):
    ready: bool
    message: str | None = None
    user: UserResponse | None = None
    history: list[HistoryDayResponse] = Field(default_factory=list)
    records: list[RecordResponse] = Field(default_factory=list)
    custom_quotes: list[QuoteItem] = Field(default_factory=list)
    faq: dict[str, list[dict[str, str]]] = Field(default_factory=dict)

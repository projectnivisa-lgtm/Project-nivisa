from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, computed_field

T = TypeVar("T")


class ApiModel(BaseModel):
    """Base for every response body.

    `from_attributes` lets a model be built straight from an ORM row.
    Field names stay snake_case on the wire: the copied backend mixed
    camelCase and snake_case across endpoints of the same service, and every
    client then had to remember which convention each route used.
    """

    model_config = ConfigDict(from_attributes=True)


class Page(ApiModel, Generic[T]):
    """One pagination envelope for every list endpoint.

    Offset-based, and it reports `total` and `has_more` rather than a page
    count, so a client never has to guess whether page numbers are 0- or
    1-indexed.
    """

    items: list[T]
    total: int
    limit: int
    offset: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def has_more(self) -> bool:
        return self.offset + len(self.items) < self.total


class PageParams(BaseModel):
    limit: int = Field(24, ge=1, le=100)
    offset: int = Field(0, ge=0)


class Message(ApiModel):
    message: str


class IdResponse(ApiModel):
    id: int

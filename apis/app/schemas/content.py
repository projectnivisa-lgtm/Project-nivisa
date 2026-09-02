from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ApiModel


class PageWrite(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    meta_title: str | None = Field(None, max_length=200)
    meta_description: str | None = Field(None, max_length=400)
    is_published: bool = True


class PageUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    body: str | None = None
    meta_title: str | None = Field(None, max_length=200)
    meta_description: str | None = Field(None, max_length=400)
    is_published: bool | None = None


class PageOut(ApiModel):
    id: int
    slug: str
    title: str
    body: str
    meta_title: str | None
    meta_description: str | None
    is_published: bool
    is_system: bool
    updated_at: datetime


class BannerWrite(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subtitle: str | None = Field(None, max_length=300)
    image_url: str = Field(min_length=1, max_length=500)
    mobile_image_url: str | None = Field(None, max_length=500)
    alt_text: str = Field(min_length=3, max_length=300)
    link_url: str | None = Field(None, max_length=500)
    cta_label: str | None = Field(None, max_length=60)
    placement: str = Field("home_hero", max_length=32)
    position: int = 0
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    is_active: bool = True


class BannerOut(ApiModel):
    id: int
    title: str
    subtitle: str | None
    image_url: str
    mobile_image_url: str | None
    alt_text: str
    link_url: str | None
    cta_label: str | None
    placement: str
    position: int
    starts_at: datetime | None
    ends_at: datetime | None
    is_active: bool


class HomepageSectionWrite(BaseModel):
    kind: str = Field(min_length=1, max_length=40)
    title: str | None = Field(None, max_length=200)
    subtitle: str | None = Field(None, max_length=300)
    config: dict = {}
    position: int = 0
    is_active: bool = True


class HomepageSectionOut(ApiModel):
    id: int
    kind: str
    title: str | None
    subtitle: str | None
    config: dict
    position: int
    is_active: bool


class SettingWrite(BaseModel):
    value: dict


class SettingOut(ApiModel):
    key: str
    value: dict
    label: str
    group: str


class UploadOut(ApiModel):
    url: str
    filename: str
    content_type: str
    size: int

// Device profiles for Jellyfin PlaybackInfo.
// 'webos': webOS hardware decoders (direct play HEVC, H.264, VP9, AV1; AC3, EAC3, AAC...).
// 'browser': headless Chromium test runner (direct play only mp4 + h264 + aac).

export function deviceProfile(target = 'browser') {
  const isWebos = target === 'webos'
  return {
    Name: isWebos ? 'LupoFlin LG webOS' : 'LupoFlin Browser',
    MaxStreamingBitrate: 120000000,
    MaxStaticBitrate: 120000000,
    DirectPlayProfiles: [
      {
        Container: isWebos ? 'mp4,m4v,mkv,webm,ts,mov' : 'mp4',
        Type: 'Video',
        VideoCodec: isWebos ? 'h264,hevc,vp9,av1' : 'h264',
        AudioCodec: isWebos ? 'aac,mp3,ac3,eac3,opus,flac' : 'aac',
      },
    ],
    TranscodingProfiles: [
      {
        Container: 'ts',
        Type: 'Video',
        Protocol: 'hls',
        VideoCodec: 'h264',
        AudioCodec: 'aac',
      },
    ],
    SubtitleProfiles: [
      { Format: 'vtt', Method: 'External' },
      { Format: 'srt', Method: 'External' },
      { Format: 'ass', Method: 'External' },
    ],
  }
}

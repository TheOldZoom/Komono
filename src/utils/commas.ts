export default function commas(num: number | string) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

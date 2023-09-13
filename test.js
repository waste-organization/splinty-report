const arr = [1,2,3,4,5]
const i = 0
arr.forEach((v,i,a) => {
    if(v == 3) a.splice(i+1,1)
    console.log(v+" "+i);
})